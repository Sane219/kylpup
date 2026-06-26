"""JWT verification + tenant resolution. This is THE isolation boundary:
service-key Supabase access bypasses RLS, so every protected route depends on
get_current_tenant() and queries must filter by the returned org_id."""
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings

bearer = HTTPBearer()


class Tenant:
    def __init__(self, user_id: str, org_id: str, role: str):
        self.user_id, self.org_id, self.role = user_id, org_id, role


def get_current_tenant(cred: HTTPAuthorizationCredentials = Depends(bearer)) -> Tenant:
    try:
        payload = jwt.decode(
            cred.credentials, settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"], audience="authenticated",
        )
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid token")
    # org_id + role are stored in app_metadata at signup. ponytail: trust the
    # signed claim; if it's absent the user never finished org setup.
    meta = payload.get("app_metadata", {})
    org_id, role = meta.get("org_id"), meta.get("role")
    if not org_id:
        raise HTTPException(403, "no organization")
    return Tenant(payload["sub"], org_id, role or "analyst")


def require_role(*roles: str):
    def dep(t: Tenant = Depends(get_current_tenant)) -> Tenant:
        if t.role not in roles:
            raise HTTPException(403, "insufficient role")
        return t
    return dep
