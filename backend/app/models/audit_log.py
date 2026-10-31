from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


# Nhật ký thay đổi của bảng books và loans. Do TRIGGER trong DB tự ghi
# (fn_audit_books, fn_audit_loans ở migration 0002), code Python chỉ đọc.
# old_data / new_data là ảnh chụp dòng trước và sau khi sửa (NULL khi INSERT / DELETE).
# changed_by là id người dùng (dạng chuỗi) do trigger đọc từ biến phiên 'app.user_id'
# (backend gán, xem app/deps.py); NULL khi thay đổi không đi qua API (seed, SQL tay).
class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    table_name: Mapped[str] = mapped_column(String(50), nullable=False)
    operation: Mapped[str] = mapped_column(String(10), nullable=False)
    row_id: Mapped[Optional[int]]
    changed_by: Mapped[Optional[str]] = mapped_column(String(100))
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    old_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    new_data: Mapped[Optional[dict]] = mapped_column(JSONB)
