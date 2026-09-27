from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.security import decode_access_token

bearer_scheme = HTTPBearer()


def get_current_claims(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    try:
        return decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


def require_admin(claims: dict = Depends(get_current_claims)) -> dict:
    if claims.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return claims
