from typing import Optional

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


# Tài khoản đăng nhập, role là 'admin' hoặc 'member'.
# Chỉ lưu hash bcrypt của mật khẩu. member_id trỏ tới hồ sơ độc giả (NULL với admin).
class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'member')", name="chk_user_role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    member_id: Mapped[Optional[int]] = mapped_column(ForeignKey("members.id"))
