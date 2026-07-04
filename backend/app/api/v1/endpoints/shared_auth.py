from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from dataclasses import dataclass
from typing import Optional

from app.db.session import get_db
from app.models.models import User, UserRole, InternalUser, InternalRole
from app.core.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


@dataclass
class ActingUser:
    """Normalized identity — either a customer-admin or an internal staff member."""
    id: int
    name: str
    role: str          # "admin" | "manager" | "sales" | "inventory"
    is_customer_admin: bool  # True for the legacy customer-table admin (irshad-style)


async def get_acting_staff_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> ActingUser:
    """
    Accepts EITHER token type:
      - customer token (users table) — must have role=admin
      - internal token (internal_users table) — any role, marked with type=internal
    Returns a normalized ActingUser regardless of source.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if payload.get("type") == "internal":
        result = await db.execute(select(InternalUser).where(InternalUser.id == int(payload.get("sub"))))
        staff = result.scalar_one_or_none()
        if not staff or not staff.is_active:
            raise HTTPException(status_code=401, detail="Staff user not found or inactive")
        return ActingUser(id=staff.id, name=staff.name, role=staff.role.value, is_customer_admin=False)

    # Fall back to customer-table token
    result = await db.execute(select(User).where(User.id == int(payload.get("sub"))))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    if user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return ActingUser(id=user.id, name=user.name, role="admin", is_customer_admin=True)


def require_roles(*allowed_roles: str):
    """
    Restrict an endpoint to specific roles, e.g. require_roles("admin", "manager", "sales").
    The legacy customer-admin always passes (role="admin" is always eligible if listed).
    """
    async def checker(acting: ActingUser = Depends(get_acting_staff_user)) -> ActingUser:
        if acting.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="You don't have permission to perform this action")
        return acting
    return checker