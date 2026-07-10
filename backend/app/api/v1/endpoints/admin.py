from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional, List

from app.db.session import get_db
from app.models.models import InternalUser, InternalRole, User
from app.core.security import get_password_hash, verify_password, create_access_token, decode_token
from app.api.v1.endpoints.auth import get_admin_user

router = APIRouter()

# Menus available per role, matching the actual sidebar sections
ROLE_MENUS: dict[str, list[str]] = {
    "admin":     ["dashboard", "products", "orders", "customers", "vendors", "accounting", "reports", "coupons", "settings", "users"],
    "manager":   ["dashboard", "products", "orders", "customers", "vendors", "accounting", "reports", "coupons", "users"],
    "sales":     ["dashboard", "orders", "customers","pos"],
    "inventory": ["dashboard", "products", "vendors"],
}


class StaffLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    role: str
    menus: List[str]


async def get_current_internal_user(token: str, db: AsyncSession) -> InternalUser:
    payload = decode_token(token)
    if not payload or payload.get("type") != "internal":
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    result = await db.execute(select(InternalUser).where(InternalUser.id == int(payload.get("sub"))))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


@router.post("/staff-login", response_model=StaffLoginResponse)
async def staff_login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(InternalUser).where(
            (InternalUser.email == form.username) | (InternalUser.phone == form.username)
        )
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token({"sub": str(user.id), "type": "internal"})
    menus = ROLE_MENUS.get(user.role.value, [])
    return StaffLoginResponse(
        access_token=token, user_id=user.id, name=user.name, role=user.role.value, menus=menus,
    )


class StaffUserOut(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str]
    role: str
    is_active: bool
    class Config:
        from_attributes = True


class CreateStaffUserRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: InternalRole


class UpdateStaffUserRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[InternalRole] = None
    is_active: Optional[bool] = None


@router.get("/staff-users", response_model=List[StaffUserOut])
async def list_staff_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    result = await db.execute(select(InternalUser).order_by(InternalUser.created_at.desc()))
    return result.scalars().all()


@router.post("/staff-users", response_model=StaffUserOut, status_code=201)
async def create_staff_user(
    payload: CreateStaffUserRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    if (await db.execute(select(InternalUser).where(InternalUser.email == payload.email))).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    if payload.phone and (await db.execute(select(InternalUser).where(InternalUser.phone == payload.phone))).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone already registered")

    user = InternalUser(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.flush()
    return user


@router.patch("/staff-users/{user_id}", response_model=StaffUserOut)
async def update_staff_user(
    user_id: int,
    payload: UpdateStaffUserRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    result = await db.execute(select(InternalUser).where(InternalUser.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Staff user not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(target, field, value)
    await db.flush()
    return target