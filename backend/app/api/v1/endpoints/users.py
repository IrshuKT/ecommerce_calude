import secrets
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.models import User, Address
from app.api.v1.endpoints.auth import get_current_user
from app.api.v1.endpoints.shared_auth import get_acting_staff_user, require_roles, ActingUser
from app.core.security import get_password_hash

router = APIRouter()


# ── List / manual create ──────────────────

@router.get("/")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin")),
    search: Optional[str] = None,
    trade_only: bool = False,
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=100),
):
    query = select(User).order_by(User.created_at.desc())
    if search:
        query = query.where(
            (User.name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%")) |
            (User.phone.ilike(f"%{search}%"))
        )
    if trade_only:
        query = query.where(User.is_trade_approved == True)
    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    users = result.scalars().all()
    return [{"id": u.id, "name": u.name, "email": u.email, "phone": u.phone,
             "role": u.role, "is_active": u.is_active,
             "is_trade_approved": u.is_trade_approved,
             "created_at": u.created_at} for u in users]


class AdminCreateCustomerRequest(BaseModel):
    name: str
    email: str
    phone: str
    password: Optional[str] = None  # blank = shop walk-in, may never log in


@router.post("/", status_code=201)
async def create_customer(
    payload: AdminCreateCustomerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin")),
):
    """Manual customer creation by shop/admin — separate from self-registration."""
    if (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    if (await db.execute(select(User).where(User.phone == payload.phone))).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone already registered")

    raw_password = payload.password or secrets.token_urlsafe(12)
    user = User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        hashed_password=get_password_hash(raw_password),
        role="customer",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email, "phone": user.phone,
            "role": user.role, "is_active": user.is_active, "created_at": user.created_at}


# ── Trade / active toggles ────────────────

@router.patch("/{user_id}/trade-approve")
async def approve_trade(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_trade_approved = True
    user.is_verified = True
    await db.commit()
    await db.refresh(user)
    return {"message": f"{user.name} approved as trade customer"}


@router.patch("/{user_id}/trade-revoke")
async def revoke_trade(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_trade_approved = False
    await db.commit()
    await db.refresh(user)
    return {"message": f"{user.name} trade access revoked"}


@router.patch("/{user_id}/toggle-active")
async def toggle_active(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    await db.commit()
    await db.refresh(user)
    return {"message": f"User {'activated' if user.is_active else 'deactivated'}"}


# ── Self profile ──────────────────────────

@router.get("/me/profile")
async def my_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role,
        "is_trade_approved": current_user.is_trade_approved,
        "is_active": current_user.is_active,
    }


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


@router.patch("/me/profile")
async def update_profile(
    payload: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.name:
        current_user.name = payload.name
    if payload.email:
        current_user.email = payload.email
    if payload.phone:
        current_user.phone = payload.phone
    await db.commit()
    return {"message": "Profile updated"}


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.patch("/me/password")
async def change_password(
    payload: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not bcrypt.checkpw(payload.current_password.encode(), current_user.hashed_password.encode()):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt()).decode()
    await db.commit()
    return {"message": "Password changed successfully"}


# ── Addresses ──────────────────────────────

class AddressIn(BaseModel):
    label: str = "Home"
    full_name: str
    phone: str
    line1: str
    line2: Optional[str] = None
    city: str
    state: str
    state_code: str
    pincode: str
    is_default: bool = False


@router.get("/addresses")
async def get_addresses(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Address).where(Address.user_id == current_user.id).order_by(Address.is_default.desc()))
    return result.scalars().all()


@router.post("/addresses", status_code=201)
async def add_address(payload: AddressIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    addr = Address(user_id=current_user.id, **payload.model_dump())
    db.add(addr)
    await db.flush()
    await db.commit()
    return {"id": addr.id, "message": "Address saved"}


@router.delete("/addresses/{address_id}", status_code=204)
async def delete_address(address_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Address).where(Address.id == address_id, Address.user_id == current_user.id))
    addr = result.scalar_one_or_none()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    await db.delete(addr)
    await db.commit()


# ── Single user lookup (must stay LAST — catch-all path) ─────────────────────

@router.get("/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db), current_user: ActingUser = Depends(require_roles("admin"))):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "name": user.name, "email": user.email, "phone": user.phone,
            "role": user.role, "is_active": user.is_active, "is_verified": user.is_verified,
            "is_trade_approved": user.is_trade_approved, "created_at": user.created_at}