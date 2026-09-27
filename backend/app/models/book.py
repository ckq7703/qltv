from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    isbn: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"))
    cover_url: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # search_vector (tsvector) được quản lý bằng trigger DB, không map ở ORM.

    category: Mapped[Optional["Category"]] = relationship(back_populates="books")
    authors: Mapped[list["Author"]] = relationship(
        secondary="book_authors", back_populates="books"
    )
    # passive_deletes=True: để Postgres tự ON DELETE CASCADE (đã khai báo ở FK trong
    # book_copies.book_id / migration 0001), tránh SQLAlchemy cố UPDATE book_id=NULL
    # trên các bản sao khi xoá sách — book_copies.book_id là NOT NULL nên sẽ lỗi nếu không có cờ này.
    copies: Mapped[list["BookCopy"]] = relationship(back_populates="book", passive_deletes=True)


class BookAuthor(Base):
    __tablename__ = "book_authors"

    book_id: Mapped[int] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"), primary_key=True
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("authors.id", ondelete="CASCADE"), primary_key=True
    )
