from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.cache.books_cache import get_cache_stats
from app.routers import (
    auth,
    authors,
    books,
    categories,
    loans,
    members,
    notifications,
    stats,
    uploads,
)

app = FastAPI(title="QLTV — Library Management API")

app.include_router(auth.router)
app.include_router(books.router)
app.include_router(authors.router)
app.include_router(categories.router)
app.include_router(members.router)
app.include_router(loans.router)
app.include_router(stats.router)
app.include_router(uploads.router)
app.include_router(notifications.router)

STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/stats/cache")
def cache_stats():
    return get_cache_stats()
