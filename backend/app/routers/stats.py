import math

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.pagination import Page

router = APIRouter(prefix="/stats", tags=["stats"])


def _paginate(page: int, page_size: int) -> tuple[int, int]:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    return page, page_size


@router.get("/top-books", response_model=Page[dict])
def top_books(page: int = 1, page_size: int = 10, db: Session = Depends(get_db)):
    page, page_size = _paginate(page, page_size)
    total = db.scalar(text("SELECT count(*) FROM v_top_borrowed_books")) or 0
    rows = (
        db.execute(
            text(
                "SELECT * FROM v_top_borrowed_books ORDER BY rank LIMIT :limit OFFSET :offset"
            ),
            {"limit": page_size, "offset": (page - 1) * page_size},
        )
        .mappings()
        .all()
    )
    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(math.ceil(total / page_size), 1),
    }


@router.get("/active-members", response_model=Page[dict])
def active_members(page: int = 1, page_size: int = 10, db: Session = Depends(get_db)):
    page, page_size = _paginate(page, page_size)
    total = db.scalar(text("SELECT count(*) FROM v_active_members")) or 0
    rows = (
        db.execute(
            text(
                "SELECT * FROM v_active_members ORDER BY activity_rank "
                "LIMIT :limit OFFSET :offset"
            ),
            {"limit": page_size, "offset": (page - 1) * page_size},
        )
        .mappings()
        .all()
    )
    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(math.ceil(total / page_size), 1),
    }


@router.post("/refresh-monthly")
def refresh_monthly_stats(db: Session = Depends(get_db)):
    db.execute(text("REFRESH MATERIALIZED VIEW mv_monthly_stats"))
    db.commit()
    return {"status": "refreshed"}
