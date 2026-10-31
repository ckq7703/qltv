# Schema (định dạng JSON vào/ra) cho xác thực
from typing import Optional

from pydantic import BaseModel


# Body của POST /auth/login.
class LoginRequest(BaseModel):
    username: str
    password: str


# Cặp token trả về sau khi đăng nhập hoặc refresh.
class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# Body của POST /auth/refresh và /auth/logout.
class RefreshRequest(BaseModel):
    refresh_token: str


# Thông tin người đang đăng nhập (GET /auth/me). Các trường member_* chỉ có
# giá trị với tài khoản member, admin thì để None.
class MeOut(BaseModel):
    user_id: int
    role: str
    member_id: Optional[int] = None
    member_full_name: Optional[str] = None
    member_email: Optional[str] = None
    member_avatar_url: Optional[str] = None
