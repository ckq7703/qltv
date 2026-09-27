from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class BorrowRequest(BaseModel):
    book_id: int
    # Bắt buộc với admin (chọn mượn hộ độc giả nào); bị bỏ qua với member —
    # member luôn mượn cho chính mình, lấy member_id từ JWT claims (xem routers/loans.py).
    member_id: Optional[int] = None


class LoanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    book_copy_id: int
    member_id: int
    borrowed_at: datetime
    due_date: datetime
    returned_at: Optional[datetime] = None


class LoanPolicy(BaseModel):
    loan_period_days: int
    max_active_loans_per_member: int
    late_fee_per_day: int
    currency: str


class LoanBookInfo(BaseModel):
    id: int
    title: str
    cover_url: Optional[str] = None
    authors: list[str] = []


class LoanMemberInfo(BaseModel):
    id: int
    full_name: str
    email: str
    avatar_url: Optional[str] = None


LoanStatus = str  # "active" | "overdue" | "returned"


class LoanDetailOut(BaseModel):
    id: int
    status: LoanStatus
    book_copy_id: int
    borrowed_at: datetime
    due_date: datetime
    returned_at: Optional[datetime] = None
    book: LoanBookInfo
    member: LoanMemberInfo
