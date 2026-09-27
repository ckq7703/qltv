from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


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
