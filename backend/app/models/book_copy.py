from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class BookCopy(Base):
    __tablename__ = "book_copies"
    __table_args__ = (
        CheckConstraint(
            "status IN ('available', 'borrowed', 'lost', 'damaged')",
            name="chk_book_copy_status",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    book_id: Mapped[int] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="available")
    version: Mapped[int] = mapped_column(nullable=False, default=0)

    book: Mapped["Book"] = relationship(back_populates="copies")
    loans: Mapped[list["Loan"]] = relationship(back_populates="book_copy")
