import math
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_admin
from app.models.member import Member
from app.models.user import User
from app.schemas.member import MemberCreate, MemberOut
from app.schemas.pagination import Page
from app.security import hash_password

router = APIRouter(prefix="/members", tags=["members"])

SortField = Literal["full_name", "joined_at"]
SORT_COLUMNS = {"full_name": Member.full_name, "joined_at": Member.joined_at}


def _to_member_out(member: Member, username: Optional[str]) -> MemberOut:
    out = MemberOut.model_validate(member)
    out.username = username
    return out


def _usernames_by_member_id(db: Session, member_ids: list[int]) -> dict[int, str]:
    if not member_ids:
        return {}
    rows = db.execute(
        select(User.member_id, User.username).where(User.member_id.in_(member_ids))
    ).all()
    return {member_id: username for member_id, username in rows}


@router.get("", response_model=Page[MemberOut])
def list_members(
    search: Optional[str] = None,
    sort_by: SortField = "full_name",
    sort_dir: Literal["asc", "desc"] = "asc",
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    filters = []
    if search:
        like = f"%{search}%"
        filters.append(or_(Member.full_name.ilike(like), Member.email.ilike(like)))

    total = db.scalar(select(func.count()).select_from(Member).where(*filters))

    order_fn = asc if sort_dir == "asc" else desc
    query = (
        select(Member)
        .where(*filters)
        .order_by(order_fn(SORT_COLUMNS[sort_by]))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    members = db.scalars(query).all()
    usernames = _usernames_by_member_id(db, [m.id for m in members])

    return {
        "items": [_to_member_out(m, usernames.get(m.id)) for m in members],
        "total": total or 0,
        "page": page,
        "page_size": page_size,
        "total_pages": max(math.ceil((total or 0) / page_size), 1),
    }


@router.post("", response_model=MemberOut, status_code=201)
def create_member(
    payload: MemberCreate, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)
):
    if bool(payload.username) != bool(payload.password):
        raise HTTPException(
            status_code=422, detail="username and password must be provided together"
        )

    member = Member(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        avatar_url=payload.avatar_url,
    )
    db.add(member)
    db.flush()

    username = None
    if payload.username and payload.password:
        existing = db.scalar(select(User).where(User.username == payload.username))
        if existing is not None:
            db.rollback()
            raise HTTPException(status_code=409, detail="Username already taken")

        user = User(
            username=payload.username,
            password_hash=hash_password(payload.password),
            role="member",
            member_id=member.id,
        )
        db.add(user)
        username = payload.username

    db.commit()
    db.refresh(member)
    return _to_member_out(member, username)
