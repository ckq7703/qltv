from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_claims
from app.models.member import Member
from app.schemas.auth import LoginRequest, MeOut, RefreshRequest, TokenPair
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    return auth_service.login(db, payload.username, payload.password)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    # Trả về cả access_token và refresh_token mới (rotation) — token cũ đã bị xoá khỏi Redis.
    return auth_service.refresh(db, payload.refresh_token)


@router.post("/logout", status_code=204)
def logout(payload: RefreshRequest):
    auth_service.logout(payload.refresh_token)


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
