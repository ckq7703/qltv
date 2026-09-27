import math
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.cache.books_cache import get_or_set_search_cache, invalidate_book_search_cache
from app.db import get_db
from app.deps import require_admin
from app.models.book import Book, BookAuthor
from app.models.book_copy import BookCopy
from app.models.loan import Loan
from app.schemas.book import BookCreate, BookOut, BookUpdate
from app.schemas.pagination import Page

router = APIRouter(prefix="/books", tags=["books"])

SortField = Literal["title", "created_at", "available_copies"]


def _book_to_dict(db: Session, book: Book) -> dict:
    total = db.scalar(
        select(func.count()).select_from(BookCopy).where(BookCopy.book_id == book.id)
    )
    available = db.scalar(
        select(func.count())
        .select_from(BookCopy)
        .where(BookCopy.book_id == book.id, BookCopy.status == "available")
    )
    out = BookOut.model_validate(book)
    out.total_copies = total or 0
    out.available_copies = available or 0
    return out.model_dump(mode="json")


@router.get("", response_model=Page[BookOut])
def list_books(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    available_only: bool = False,
    sort_by: SortField = "created_at",
    sort_dir: Literal["asc", "desc"] = "desc",
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    def _load() -> dict:
        query = select(Book)
        if category_id is not None:
            query = query.where(Book.category_id == category_id)
        if search:
            query = query.where(
                text("search_vector @@ plainto_tsquery('simple', :search)")
            ).params(search=search)

        books = db.scalars(query).all()
        rows = [_book_to_dict(db, b) for b in books]

        if available_only:
            rows = [r for r in rows if r["available_copies"] > 0]

        reverse = sort_dir == "desc"
        if sort_by == "available_copies":
            rows.sort(key=lambda r: r["available_copies"], reverse=reverse)
        elif sort_by == "title":
            rows.sort(key=lambda r: r["title"].lower(), reverse=reverse)
        else:
            rows.sort(key=lambda r: r["created_at"], reverse=reverse)

        total = len(rows)
        start = (page - 1) * page_size
        items = rows[start : start + page_size]
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(math.ceil(total / page_size), 1),
        }

    cache_params = {
        "search": search,
        "category_id": category_id,
        "available_only": available_only,
        "sort_by": sort_by,
        "sort_dir": sort_dir,
        "page": page,
        "page_size": page_size,
    }
    return get_or_set_search_cache(cache_params, _load)


@router.post("", response_model=BookOut, status_code=201)
def create_book(
    payload: BookCreate, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)
):
    book = Book(
        title=payload.title,
        isbn=payload.isbn,
        category_id=payload.category_id,
        cover_url=payload.cover_url,
    )
    db.add(book)
    db.flush()

    for author_id in payload.author_ids:
        db.add(BookAuthor(book_id=book.id, author_id=author_id))

    for _ in range(max(payload.copies_count, 0)):
        db.add(BookCopy(book_id=book.id, status="available"))

    db.commit()
    db.refresh(book)
    invalidate_book_search_cache()
    return _book_to_dict(db, book)


@router.put("/{book_id}", response_model=BookOut)
def update_book(
    book_id: int,
    payload: BookUpdate,
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")

    for field in ("title", "isbn", "category_id", "cover_url"):
        value = getattr(payload, field)
        if value is not None:
            setattr(book, field, value)

    if payload.author_ids is not None:
        db.query(BookAuthor).filter(BookAuthor.book_id == book_id).delete()
        for author_id in payload.author_ids:
            db.add(BookAuthor(book_id=book_id, author_id=author_id))

    db.commit()
    db.refresh(book)
    invalidate_book_search_cache()
    return _book_to_dict(db, book)


class AddCopiesRequest(BaseModel):
    count: int


@router.post("/{book_id}/copies", response_model=BookOut)
def add_book_copies(
    book_id: int,
    payload: AddCopiesRequest,
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    """Thêm N bản sao mới (available) cho một đầu sách đã có.
    Không hỗ trợ giảm số bản sao qua API này — muốn loại bỏ một bản sao cụ thể
    (hỏng/mất), thao tác trực tiếp trên `book_copies.status` vì cần chọn đúng
    bản sao nào đang 'available', không thể suy luận từ một con số tổng.
    """
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
    if payload.count <= 0:
        raise HTTPException(status_code=422, detail="count must be positive")

    for _ in range(payload.count):
        db.add(BookCopy(book_id=book_id, status="available"))

    db.commit()
    db.refresh(book)
    invalidate_book_search_cache()
    return _book_to_dict(db, book)


class BookCopyOut(BaseModel):
    id: int
    status: str


@router.get("/{book_id}/copies", response_model=list[BookCopyOut])
def list_book_copies(
    book_id: int, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)
):
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
    copies = db.scalars(
        select(BookCopy).where(BookCopy.book_id == book_id).order_by(BookCopy.id)
    ).all()
    return [BookCopyOut(id=c.id, status=c.status) for c in copies]


class UpdateCopyStatusRequest(BaseModel):
    status: Literal["available", "lost", "damaged"]


@router.patch("/{book_id}/copies/{copy_id}", response_model=BookCopyOut)
def update_copy_status(
    book_id: int,
    copy_id: int,
    payload: UpdateCopyStatusRequest,
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    """Đánh dấu 1 bản sao cụ thể là mất/hỏng (hoặc khôi phục lại available) —
    đây là cách "giảm số bản sao" đúng nghiệp vụ: không xoá row (giữ audit trail/
    lịch sử mượn qua FK từ `loans`), chỉ đổi trạng thái. Không cho đổi trạng thái
    một bản sao đang `borrowed` — việc đó do trigger `trg_after_loan_return` quản lý.
    """
    copy = db.get(BookCopy, copy_id)
    if copy is None or copy.book_id != book_id:
        raise HTTPException(status_code=404, detail="Book copy not found")
    if copy.status == "borrowed":
        raise HTTPException(
            status_code=409, detail="Cannot change status of a copy that is currently borrowed"
        )
    copy.status = payload.status
    db.commit()
    invalidate_book_search_cache()
    return BookCopyOut(id=copy.id, status=copy.status)


@router.delete("/{book_id}", status_code=204)
def delete_book(
    book_id: int, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)
):
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")

    has_loan_history = db.scalar(
        select(func.count())
        .select_from(Loan)
        .join(BookCopy, BookCopy.id == Loan.book_copy_id)
        .where(BookCopy.book_id == book_id)
    )
    if has_loan_history:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a book that has loan history (preserves audit trail)",
        )

    db.delete(book)
    db.commit()
    invalidate_book_search_cache()
