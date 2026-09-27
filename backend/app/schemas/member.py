from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class MemberCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    # Tuỳ chọn: nếu cả hai được điền, tạo luôn tài khoản đăng nhập (role=member)
    # gắn với độc giả này để họ tự mượn/trả sách ngay — xem routers/members.py.
    username: Optional[str] = None
    password: Optional[str] = None


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    joined_at: datetime
    username: Optional[str] = None
