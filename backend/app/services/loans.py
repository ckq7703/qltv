from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.cache.books_cache import invalidate_book_search_cache
from app.models.book_copy import BookCopy
from app.models.loan import Loan

MAX_ACTIVE_LOANS_PER_MEMBER = 3
LOAN_PERIOD_DAYS = 14
# Chỉ mang tính thông báo trong wizard mượn sách — dự án chưa tích hợp thanh toán
# nên không có luồng thu phí thật, đây là con số hiển thị theo nội quy thư viện.
LATE_FEE_PER_DAY = 5000
LATE_FEE_CURRENCY = "VND"


def get_policy() -> dict:
    return {
        "loan_period_days": LOAN_PERIOD_DAYS,
        "max_active_loans_per_member": MAX_ACTIVE_LOANS_PER_MEMBER,
        "late_fee_per_day": LATE_FEE_PER_DAY,
        "currency": LATE_FEE_CURRENCY,
    }


def borrow_book(db: Session, book_id: int, member_id: int) -> Loan:
    """Xử lý mượn sách trong 1 transaction, dùng SELECT ... FOR UPDATE SKIP LOCKED
    để tránh 2 độc giả cùng mượn trùng 1 bản sao khi tương tranh.
    Xem docs/DATABASE.md mục 3 (Concurrency control) để biết chi tiết thiết kế.
    """
    try:
        copy_id = db.scalar(
            select(BookCopy.id)
            .where(BookCopy.book_id == book_id, BookCopy.status == "available")
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if copy_id is None:
            raise HTTPException(status_code=409, detail="No available copy for this book")

        active_loans = db.scalar(
            select(func.count())
            .select_from(Loan)
            .where(Loan.member_id == member_id, Loan.returned_at.is_(None))
        )
        if active_loans >= MAX_ACTIVE_LOANS_PER_MEMBER:
            raise HTTPException(
                status_code=409,
                detail=f"Member already has {MAX_ACTIVE_LOANS_PER_MEMBER} active loans",
            )

        loan = Loan(
            book_copy_id=copy_id,
            member_id=member_id,
            due_date=datetime.now(timezone.utc) + timedelta(days=LOAN_PERIOD_DAYS),
        )
        db.add(loan)
        db.commit()
        db.refresh(loan)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    invalidate_book_search_cache()
    return loan


def return_book(db: Session, loan_id: int) -> Loan:
    loan = db.get(Loan, loan_id)
    if loan is None:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan.returned_at is not None:
        raise HTTPException(status_code=409, detail="Loan already returned")

    loan.returned_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(loan)
    invalidate_book_search_cache()
    return loan
