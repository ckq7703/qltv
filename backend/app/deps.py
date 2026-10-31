# Dependency xác thực / phân quyền dùng chung cho các router
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.security import decode_access_token

bearer_scheme = HTTPBearer()


# Đọc header "Authorization: Bearer <token>", trả về claims trong JWT.
# Token sai hoặc hết hạn -> 401.
def get_current_claims(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    try:
        return decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


# Chặn endpoint chỉ dành cho admin. Đã đăng nhập nhưng không phải admin -> 403.
def require_admin(claims: dict = Depends(get_current_claims)) -> dict:
    if claims.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return claims


# Như get_current_claims, nhưng đồng thời ghi user id vào biến phiên 'app.user_id'
# của transaction hiện tại để trigger audit (fn_audit_books / fn_audit_loans) điền
# audit_log.changed_by. set_config(..., true) chỉ có hiệu lực trong transaction này
# nên không rò sang request khác dùng chung kết nối trong pool.
# Dùng cho các endpoint GHI vào books / loans; get_db được cache theo request nên
# đây chính là session mà endpoint sẽ dùng để ghi.
def audited_claims(
    claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)
) -> dict:
    db.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(claims["sub"])})
    return claims


# Kết hợp require_admin và audited_claims cho endpoint admin có ghi dữ liệu được audit.
def audited_admin(claims: dict = Depends(audited_claims)) -> dict:
    if claims.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return claims
