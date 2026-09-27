from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AuthorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    parent_id: Optional[int] = None


class BookCreate(BaseModel):
    title: str
    isbn: str
    category_id: Optional[int] = None
    cover_url: Optional[str] = None
    author_ids: list[int] = []
    copies_count: int = 1


class BookUpdate(BaseModel):
    title: Optional[str] = None
    isbn: Optional[str] = None
    category_id: Optional[int] = None
    cover_url: Optional[str] = None
    author_ids: Optional[list[int]] = None


class BookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    isbn: str
    category_id: Optional[int] = None
    cover_url: Optional[str] = None
    created_at: datetime
    authors: list[AuthorOut] = []
    available_copies: int = 0
    total_copies: int = 0
