from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.cache.books_cache import invalidate_book_search_cache
from app.db import get_db
from app.deps import require_admin
from app.models.book import Book
from app.models.category import Category
from app.schemas.book import CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


class CategoryCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class CategoryUpdate(BaseModel):
    name: str
    parent_id: Optional[int] = None


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.name)).all()


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    category = Category(name=payload.name, parent_id=payload.parent_id)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    if payload.parent_id == category_id:
        raise HTTPException(status_code=422, detail="A category cannot be its own parent")

    category.name = payload.name
    category.parent_id = payload.parent_id
    db.commit()
    db.refresh(category)
    invalidate_book_search_cache()
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: int, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)
):
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    child_count = db.scalar(
        select(func.count()).select_from(Category).where(Category.parent_id == category_id)
    )
    if child_count:
        raise HTTPException(
            status_code=409, detail="Cannot delete a category that has subcategories"
        )

    book_count = db.scalar(
        select(func.count()).select_from(Book).where(Book.category_id == category_id)
    )
    if book_count:
        raise HTTPException(
            status_code=409, detail="Cannot delete a category that still has books assigned"
        )

    db.delete(category)
    db.commit()
    invalidate_book_search_cache()
