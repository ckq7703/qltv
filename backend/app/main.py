# Điểm vào của ứng dụng FastAPI: gắn các router, thư mục static, health check
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.cache.books_cache import get_cache_stats
from app.routers import (
    audit_logs,
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

# Mỗi router là một nhóm endpoint trong app/routers/
app.include_router(auth.router)
app.include_router(books.router)
app.include_router(authors.router)
app.include_router(categories.router)
app.include_router(members.router)
app.include_router(loans.router)
app.include_router(stats.router)
app.include_router(uploads.router)
app.include_router(notifications.router)
app.include_router(audit_logs.router)

# File upload (ảnh bìa, avatar) được phục vụ công khai tại /static/...
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# Kiểm tra backend còn sống (dùng cho Docker healthcheck).
@app.get("/health")
def health():
    return {"status": "ok"}


# Số lần cache tìm kiếm sách trúng / trượt trong Redis.
@app.get("/stats/cache")
def cache_stats():
    return get_cache_stats()
