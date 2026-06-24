from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from app.db.session import get_db
from app.models.models import Coupon
from app.api.v1.endpoints.auth import get_admin_user, get_current_user
from app.models.models import User

router = APIRouter()

class ValidateCouponRequest(BaseModel):
    code: str
    order_amount: float

@router.post("/validate")
async def validate_coupon(payload: ValidateCouponRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Coupon).where(Coupon.code == payload.code.upper(), Coupon.is_active == True))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid coupon code")
    if coupon.valid_until and coupon.valid_until < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Coupon has expired")
    if coupon.usage_limit and coupon.used_count >= coupon.usage_limit:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    if coupon.min_order_amount and payload.order_amount < float(coupon.min_order_amount):
        raise HTTPException(status_code=400, detail=f"Minimum order amount ₹{coupon.min_order_amount} required")

    if coupon.coupon_type == "percentage":
        discount = payload.order_amount * float(coupon.value) / 100
        if coupon.max_discount_amount:
            discount = min(discount, float(coupon.max_discount_amount))
    else:
        discount = min(float(coupon.value), payload.order_amount)

    return {"discount_amount": round(discount, 2), "coupon_type": coupon.coupon_type, "value": float(coupon.value), "description": coupon.description}

@router.get("/")
async def list_coupons(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_admin_user)):
    result = await db.execute(select(Coupon).order_by(Coupon.created_at.desc()))
    return result.scalars().all()

@router.post("/", status_code=201)
async def create_coupon(payload: dict, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_admin_user)):
    coupon = Coupon(**{k: v for k, v in payload.items() if hasattr(Coupon, k)})
    db.add(coupon)
    await db.flush()
    return {"id": coupon.id, "code": coupon.code}
