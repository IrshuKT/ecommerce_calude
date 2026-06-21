from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import razorpay, hmac, hashlib

from app.db.session import get_db
from app.models.models import Order, PaymentStatus, OrderStatus, OrderTracking, User
from app.api.v1.endpoints.auth import get_current_user
from app.core.config import settings

router = APIRouter()
rz_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


class CreateRazorpayOrderRequest(BaseModel):
    order_number: str


class VerifyPaymentRequest(BaseModel):
    order_number: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/create-razorpay-order")
async def create_razorpay_order(payload: CreateRazorpayOrderRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.order_number == payload.order_number, Order.user_id == current_user.id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    rz_order = rz_client.order.create({"amount": int(order.total_amount * 100), "currency": "INR", "receipt": order.order_number})
    order.razorpay_order_id = rz_order["id"]
    return {"razorpay_order_id": rz_order["id"], "amount": int(order.total_amount * 100), "currency": "INR", "key": settings.RAZORPAY_KEY_ID}


@router.post("/verify")
async def verify_payment(payload: VerifyPaymentRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    generated_signature = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode(),
        hashlib.sha256).hexdigest()
    if generated_signature != payload.razorpay_signature:
        raise HTTPException(status_code=400, detail="Payment verification failed")
    result = await db.execute(select(Order).where(Order.order_number == payload.order_number, Order.user_id == current_user.id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.razorpay_payment_id = payload.razorpay_payment_id
    order.payment_status = PaymentStatus.paid
    order.status = OrderStatus.confirmed
    db.add(OrderTracking(order_id=order.id, status=OrderStatus.confirmed, message="Payment received. Order confirmed."))
    return {"message": "Payment verified successfully"}
