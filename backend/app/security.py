# Băm mật khẩu (bcrypt) và tạo / giải mã JWT
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Băm mật khẩu bằng bcrypt để lưu vào DB (không lưu mật khẩu gốc).
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


# So khớp mật khẩu nhập vào với hash đã lưu.
def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


# Tạo JWT access token chứa user id (sub), role, member_id và hạn dùng (exp).
def create_access_token(user_id: int, role: str, member_id: int | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_ttl_minutes)
    payload = {
        "sub": str(user_id),
        "role": role,
        "member_id": member_id,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


# Kiểm tra chữ ký và hạn dùng của token. Mọi lỗi đều đổi thành ValueError
# để tầng trên (deps.py) trả về 401.
def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise ValueError("Invalid or expired token")


# Refresh token là chuỗi ngẫu nhiên (không phải JWT), được lưu trong Redis.
def new_refresh_token() -> str:
    return uuid.uuid4().hex
