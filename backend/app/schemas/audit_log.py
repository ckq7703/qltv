from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# Một dòng audit log trả về frontend. changed_by là user id (chuỗi) do trigger ghi,
# changed_by_username là tên tương ứng trong bảng users (None nếu thay đổi không qua API
# hoặc tài khoản đã bị xóa). old_data / new_data là ảnh chụp dòng trước / sau khi sửa.
class AuditLogOut(BaseModel):
    id: int
    table_name: str
    operation: str
    row_id: Optional[int]
    changed_by: Optional[str]
    changed_by_username: Optional[str]
    changed_at: datetime
    old_data: Optional[dict]
    new_data: Optional[dict]
