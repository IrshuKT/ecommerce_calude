from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.db.session import get_db
from app.models.models import User
from app.api.v1.endpoints.auth import get_current_user, get_admin_user

router = APIRouter()


@router.get("/")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
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


@router.patch("/{user_id}/trade-approve")
async def approve_trade(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_trade_approved = True
    return {"message": f"{user.name} approved as trade customer"}


@router.patch("/{user_id}/trade-revoke")
async def revoke_trade(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_trade_approved = False
    return {"message": f"{user.name} trade access revoked"}


@router.patch("/{user_id}/toggle-active")
async def toggle_active(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    return {"message": f"User {'activated' if user.is_active else 'deactivated'}"}


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


# ── Address endpoints ─────────────────────

from app.models.models import Address

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
    return {"id": addr.id, "message": "Address saved"}

@router.delete("/addresses/{address_id}", status_code=204)
async def delete_address(address_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Address).where(Address.id == address_id, Address.user_id == current_user.id))
    addr = result.scalar_one_or_none()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    await db.delete(addr)
