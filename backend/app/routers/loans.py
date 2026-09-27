import math
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import asc, desc, func, select, text
from sqlalchemy.orm import Session

from datetime import datetime, timezone

from app.db import get_db
from app.deps import get_current_claims
from app.models.book import Book
from app.models.book_copy import BookCopy
from app.models.loan import Loan
from app.models.member import Member
from app.notifications import notify_book_borrowed
from app.schemas.loan import (
    BorrowRequest,
    LoanBookInfo,
    LoanDetailOut,
    LoanMemberInfo,
    LoanOut,
    LoanPolicy,
)
from app.schemas.pagination import Page
from app.services.loans import borrow_book, get_policy, return_book

router = APIRouter(prefix="/loans", tags=["loans"])

SortField = Literal["due_date", "borrowed_at"]
SORT_COLUMNS = {"due_date": Loan.due_date, "borrowed_at": Loan.borrowed_at}


def _member_id_of(claims: dict) -> int:
    member_id = claims.get("member_id")
    if member_id is None:
        raise HTTPException(
            status_code=403,
            detail="This account is not linked to a member profile — ask a librarian to link it",
        )
    return member_id


@router.get("/policy", response_model=LoanPolicy)
def loan_policy():
    """Nội quy mượn sách — nguồn sự thật duy nhất, tránh hardcode rải rác ở frontend."""
    return get_policy()


@router.post("/borrow", response_model=LoanOut, status_code=201)
def borrow(
    payload: BorrowRequest,
    db: Session = Depends(get_db),
    claims: dict = Depends(get_current_claims),
):
    is_self_service = claims.get("role") != "admin"
    if not is_self_service:
        if payload.member_id is None:
            raise HTTPException(status_code=422, detail="member_id is required for admin borrow")
        member_id = payload.member_id
    else:
        # Member chỉ được mượn cho chính mình — member_id trong payload (nếu có) bị bỏ qua
        # để tránh một member giả mạo mượn hộ member khác qua việc sửa body request.
        member_id = _member_id_of(claims)

    loan = borrow_book(db, payload.book_id, member_id)

    if is_self_service:
        # Chỉ báo cho admin khi member TỰ mượn — admin mượn hộ thì không cần tự báo cho chính mình.
        book_title = db.scalar(
            select(Book.title).join(BookCopy, BookCopy.book_id == Book.id).where(
                BookCopy.id == loan.book_copy_id
            )
        )
        member_name = db.scalar(select(Member.full_name).where(Member.id == member_id))
        notify_book_borrowed(
            loan_id=loan.id,
            book_title=book_title or "Unknown book",
            member_name=member_name or "Unknown member",
            due_date=loan.due_date,
        )

    return loan


@router.post("/{loan_id}/return", response_model=LoanOut)
def return_loan(
    loan_id: int,
    db: Session = Depends(get_db),
    claims: dict = Depends(get_current_claims),
):
    if claims.get("role") != "admin":
        member_id = _member_id_of(claims)
        loan = db.get(Loan, loan_id)
        if loan is None:
            raise HTTPException(status_code=404, detail="Loan not found")
        if loan.member_id != member_id:
            raise HTTPException(status_code=403, detail="You can only return your own loans")

    return return_book(db, loan_id)


def _loan_status(loan: Loan) -> str:
    if loan.returned_at is not None:
        return "returned"
    due_date = loan.due_date
    if due_date.tzinfo is None:
        due_date = due_date.replace(tzinfo=timezone.utc)
    if due_date < datetime.now(timezone.utc):
        return "overdue"
    return "active"


@router.get("/{loan_id}", response_model=LoanDetailOut)
def get_loan(
    loan_id: int,
    db: Session = Depends(get_db),
    claims: dict = Depends(get_current_claims),
):
    """Chi tiết 1 phiếu mượn — dùng khi admin bấm vào 1 thông báo realtime để mở thẳng phiếu đó."""
    loan = db.get(Loan, loan_id)
    if loan is None:
        raise HTTPException(status_code=404, detail="Loan not found")

    if claims.get("role") != "admin":
        member_id = _member_id_of(claims)
        if loan.member_id != member_id:
            raise HTTPException(status_code=403, detail="You can only view your own loans")

    book = db.scalar(
        select(Book).join(BookCopy, BookCopy.book_id == Book.id).where(BookCopy.id == loan.book_copy_id)
    )
    member = db.get(Member, loan.member_id)
    if book is None or member is None:
        raise HTTPException(status_code=404, detail="Loan references missing book or member")

    return LoanDetailOut(
        id=loan.id,
        status=_loan_status(loan),
        book_copy_id=loan.book_copy_id,
        borrowed_at=loan.borrowed_at,
        due_date=loan.due_date,
        returned_at=loan.returned_at,
        book=LoanBookInfo(
            id=book.id,
            title=book.title,
            cover_url=book.cover_url,
            authors=[a.full_name for a in book.authors],
        ),
        member=LoanMemberInfo(
            id=member.id,
            full_name=member.full_name,
            email=member.email,
            avatar_url=member.avatar_url,
        ),
    )


@router.get("", response_model=Page[dict])
def list_loans(
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: SortField = "due_date",
    sort_dir: Literal["asc", "desc"] = "asc",
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    claims: dict = Depends(get_current_claims),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    offset = (page - 1) * page_size

    # Member chỉ thấy phiếu mượn của chính mình; admin thấy toàn bộ.
    own_member_id = None if claims.get("role") == "admin" else _member_id_of(claims)

    if status == "overdue":
        # v_overdue_loans chỉ có due_date/overdue_by — join thêm loans/books/members để
        # bảng ở frontend hiển thị tên sách + tên/avatar độc giả thay vì chỉ ID thô.
        # sort_dir đã được FastAPI validate qua Literal["asc", "desc"] nên an toàn khi nội suy trực tiếp vào SQL.
        conditions = []
        params: dict = {"limit": page_size, "offset": offset}
        if own_member_id is not None:
            conditions.append("v.member_id = :member_id")
            params["member_id"] = own_member_id
        if search:
            conditions.append("(b.title ILIKE :search OR m.full_name ILIKE :search)")
            params["search"] = f"%{search}%"
        where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        total = db.scalar(
            text(
                "SELECT count(*) FROM v_overdue_loans v "
                "JOIN books b ON b.id = v.book_id "
                "JOIN members m ON m.id = v.member_id "
                f"{where_clause}"
            ),
            params,
        ) or 0
        rows = (
            db.execute(
                text(
                    "SELECT v.id, v.member_id, v.book_id, v.due_date, v.overdue_by, "
                    "l.book_copy_id, l.borrowed_at, "
                    "b.title AS book_title, b.cover_url AS book_cover_url, "
                    "m.full_name AS member_full_name, m.avatar_url AS member_avatar_url "
                    "FROM v_overdue_loans v "
                    "JOIN loans l ON l.id = v.id "
                    "JOIN books b ON b.id = v.book_id "
                    "JOIN members m ON m.id = v.member_id "
                    f"{where_clause} ORDER BY v.due_date {sort_dir} "
                    "LIMIT :limit OFFSET :offset"
                ),
                params,
            )
            .mappings()
            .all()
        )
        items = [dict(r) for r in rows]
    else:
        query = (
            select(Loan, Book, Member)
            .join(BookCopy, BookCopy.id == Loan.book_copy_id)
            .join(Book, Book.id == BookCopy.book_id)
            .join(Member, Member.id == Loan.member_id)
        )
        if status == "borrowed":
            query = query.where(Loan.returned_at.is_(None))
        elif status == "returned":
            query = query.where(Loan.returned_at.is_not(None))
        if own_member_id is not None:
            query = query.where(Loan.member_id == own_member_id)
        if search:
            like = f"%{search}%"
            query = query.where(Book.title.ilike(like) | Member.full_name.ilike(like))

        total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

        order_fn = asc if sort_dir == "asc" else desc
        query = query.order_by(order_fn(SORT_COLUMNS[sort_by])).offset(offset).limit(page_size)
        rows = db.execute(query).all()
        items = [
            {
                **LoanOut.model_validate(loan).model_dump(mode="json"),
                "book_title": book.title,
                "book_cover_url": book.cover_url,
                "member_full_name": member.full_name,
                "member_avatar_url": member.avatar_url,
            }
            for loan, book, member in rows
        ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(math.ceil(total / page_size), 1),
    }
