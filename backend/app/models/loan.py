from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Loan(Base):
    __tablename__ = "loans"
    __table_args__ = (
        CheckConstraint(
            "returned_at IS NULL OR returned_at >= borrowed_at",
            name="chk_return_after_borrow",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    book_copy_id: Mapped[int] = mapped_column(
        ForeignKey("book_copies.id"), nullable=False
    )
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False)
    borrowed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    returned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    book_copy: Mapped["BookCopy"] = relationship(back_populates="loans")
    member: Mapped["Member"] = relationship(back_populates="loans")
