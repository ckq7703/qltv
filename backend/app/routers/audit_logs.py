# Endpoint đọc nhật ký thay đổi (audit_log) cho admin. Dữ liệu do trigger DB ghi,
# router này chỉ đọc, không có endpoint ghi / sửa / xóa.
import math
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import String, cast, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_admin
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit_log import AuditLogOut
from app.schemas.pagination import Page

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


# Danh sách audit log, mới nhất trước. Lọc theo bảng, loại thao tác, id dòng bị sửa
# và khoảng thời gian; có phân trang. changed_by lưu user id (dạng chuỗi) nên LEFT JOIN
# users để trả thêm username; thay đổi không qua API (seed, SQL tay) có changed_by NULL.
@router.get("", response_model=Page[AuditLogOut])
def list_audit_logs(
    table_name: Optional[Literal["books", "loans"]] = None,
    operation: Optional[Literal["INSERT", "UPDATE", "DELETE"]] = None,
    row_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    query = select(AuditLog, User.username).outerjoin(
        User, cast(User.id, String) == AuditLog.changed_by
    )
    if table_name is not None:
        query = query.where(AuditLog.table_name == table_name)
    if operation is not None:
        query = query.where(AuditLog.operation == operation)
    if row_id is not None:
        query = query.where(AuditLog.row_id == row_id)
    if date_from is not None:
        query = query.where(AuditLog.changed_at >= date_from)
    if date_to is not None:
        query = query.where(AuditLog.changed_at <= date_to)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.execute(
        query.order_by(AuditLog.changed_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [
        AuditLogOut(
            id=log.id,
            table_name=log.table_name,
            operation=log.operation,
            row_id=log.row_id,
            changed_by=log.changed_by,
            changed_by_username=username,
            changed_at=log.changed_at,
            old_data=log.old_data,
            new_data=log.new_data,
        )
        for log, username in rows
    ]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(math.ceil(total / page_size), 1),
    }
