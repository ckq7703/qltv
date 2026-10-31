# Endpoint xác thực: /auth/login, /refresh, /logout, /me.
# Router chỉ nhận request rồi gọi services/auth.py, không chứa logic.
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_claims
from app.models.member import Member
from app.schemas.auth import LoginRequest, MeOut, RefreshRequest, TokenPair
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


# Đăng nhập, trả về access_token + refresh_token.
@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    return auth_service.login(db, payload.username, payload.password)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    # Trả về cả access_token và refresh_token mới (rotation) — token cũ đã bị xoá khỏi Redis.
    return auth_service.refresh(db, payload.refresh_token)


# Đăng xuất: thu hồi refresh token (204 = không có body trả về).
@router.post("/logout", status_code=204)
def logout(payload: RefreshRequest):
    auth_service.logout(payload.refresh_token)


# Thông tin người đang đăng nhập. Lấy từ JWT claims; với member thì truy vấn
# thêm bảng members để lấy tên, email, avatar.
@router.get("/me", response_model=MeOut)
def me(db: Session = Depends(get_db), claims: dict = Depends(get_current_claims)):
    member = None
    member_id = claims.get("member_id")
    if member_id is not None:
        member = db.get(Member, member_id)
    return MeOut(
        user_id=int(claims["sub"]),
        role=claims["role"],
        member_id=member_id,
        member_full_name=member.full_name if member else None,
        member_email=member.email if member else None,
        member_avatar_url=member.avatar_url if member else None,
    )
