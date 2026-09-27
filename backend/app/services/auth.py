from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cache.redis_client import redis_client
from app.config import settings
from app.models.user import User
from app.security import (
    create_access_token,
    new_refresh_token,
    verify_password,
)

REFRESH_KEY_PREFIX = "refresh_token:"


def _refresh_ttl_seconds() -> int:
    return settings.jwt_refresh_ttl_days * 24 * 60 * 60


def login(db: Session, username: str, password: str) -> dict:
    user = db.scalar(select(User).where(User.username == username))
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    access_token = create_access_token(user.id, user.role, user.member_id)
    refresh_token = new_refresh_token()
    redis_client.set(
        f"{REFRESH_KEY_PREFIX}{refresh_token}", str(user.id), ex=_refresh_ttl_seconds()
    )
    return {"access_token": access_token, "refresh_token": refresh_token}


def refresh(db: Session, refresh_token: str) -> dict:
    key = f"{REFRESH_KEY_PREFIX}{refresh_token}"
    user_id = redis_client.get(key)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = db.get(User, int(user_id))
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    # Rotate refresh token: xoá token cũ, phát token mới — hạn chế rủi ro khi token bị lộ.
    redis_client.delete(key)
    new_token = new_refresh_token()
    redis_client.set(
        f"{REFRESH_KEY_PREFIX}{new_token}", str(user.id), ex=_refresh_ttl_seconds()
    )
    access_token = create_access_token(user.id, user.role, user.member_id)
    return {"access_token": access_token, "refresh_token": new_token}


def logout(refresh_token: str) -> None:
    redis_client.delete(f"{REFRESH_KEY_PREFIX}{refresh_token}")
