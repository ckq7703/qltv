from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_admin
from app.models.author import Author
from app.schemas.book import AuthorOut

router = APIRouter(prefix="/authors", tags=["authors"])


@router.get("", response_model=list[AuthorOut])
def list_authors(db: Session = Depends(get_db)):
    return db.scalars(select(Author)).all()


@router.post("", response_model=AuthorOut, status_code=201)
def create_author(
    full_name: str, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)
):
    author = Author(full_name=full_name)
    db.add(author)
    db.commit()
    db.refresh(author)
    return author
