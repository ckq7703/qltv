from typing import Optional

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class MeOut(BaseModel):
    user_id: int
    role: str
    member_id: Optional[int] = None
    member_full_name: Optional[str] = None
    member_email: Optional[str] = None
    member_avatar_url: Optional[str] = None
