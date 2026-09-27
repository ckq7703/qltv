import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.deps import require_admin

router = APIRouter(prefix="/uploads", tags=["uploads"])

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
COVERS_DIR = STATIC_DIR / "covers"
COVERS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB — đủ cho ảnh bìa sách, tránh lạm dụng lưu trữ local.


@router.post("/cover")
async def upload_cover(
    file: UploadFile, _admin: dict = Depends(require_admin)
) -> dict:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=422, detail="Only PNG/JPEG/WEBP/GIF images are allowed")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image must be smaller than 5MB")

    ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif"}[
        file.content_type
    ]
    filename = f"{uuid.uuid4().hex}.{ext}"
    (COVERS_DIR / filename).write_bytes(contents)

    return {"url": f"/static/covers/{filename}"}
