# Schema cho sách, tác giả, thể loại.
# from_attributes=True cho phép tạo schema trực tiếp từ object ORM.
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


# Body tạo sách. copies_count là số bản sao vật lý được tạo kèm.
class BookCreate(BaseModel):
    title: str
    isbn: str
    category_id: Optional[int] = None
    cover_url: Optional[str] = None
    author_ids: list[int] = []
    copies_count: int = 1


# Body sửa sách: trường nào là None thì giữ nguyên giá trị cũ.
class BookUpdate(BaseModel):
    title: Optional[str] = None
    isbn: Optional[str] = None
    category_id: Optional[int] = None
    cover_url: Optional[str] = None
    author_ids: Optional[list[int]] = None


# Sách trả về cho client. available_copies / total_copies không phải cột DB,
# được router tính thêm.
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
