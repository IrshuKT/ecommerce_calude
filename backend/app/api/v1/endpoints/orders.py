from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
import random, string

from app.db.session import get_db
from app.models.models import (Order, OrderItem, OrderTracking, CartItem, ProductVariant,
    Product, Address, Coupon, User, OrderStatus, PaymentMethod, PaymentStatus)
from app.api.v1.endpoints.auth import get_current_user
from app.core.config import settings

router = APIRouter()


def generate_order_number():
    return f"GS{datetime.now().strftime('%y%m%d')}{''.join(random.choices(string.digits, k=6))}"


def calculate_gst(amount, gst_rate, is_interstate):
    tax = (amount * gst_rate / 100).quantize(Decimal("0.01"))
    if is_interstate:
        return Decimal(0), Decimal(0), tax
    half = (tax / 2).quantize(Decimal("0.01"))
    return half, tax - half, Decimal(0)


class PlaceOrderRequest(BaseModel):
    address_id: int
    payment_method: PaymentMethod
    coupon_code: Optional[str] = None
    notes: Optional[str] = None


@router.post("/", status_code=201)
async def place_order(payload: PlaceOrderRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cart_result = await db.execute(
        select(CartItem).options(selectinload(CartItem.variant).selectinload(ProductVariant.product))
        .where(CartItem.user_id == current_user.id))
    cart_items = cart_result.scalars().all()
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    addr_result = await db.execute(select(Address).where(Address.id == payload.address_id, Address.user_id == current_user.id))
    address = addr_result.scalar_one_or_none()
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    is_interstate = address.state_code != settings.STORE_STATE_CODE
    subtotal = Decimal(0)
    order_items_data = []

    for item in cart_items:
        v = item.variant
        p = v.product
        if v.track_inventory and v.stock_qty < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {p.name}")
        if p.price_type == "per_sqft" and item.custom_width_ft and item.custom_height_ft:
            area = (item.custom_width_ft * item.custom_height_ft).quantize(Decimal("0.01"))
            unit_price = (v.price * area).quantize(Decimal("0.01"))
        else:
            area = None
            unit_price = v.price
        line_total = (unit_price * item.quantity).quantize(Decimal("0.01"))
        subtotal += line_total
        order_items_data.append({"variant": v, "product": p, "item": item, "unit_price": unit_price, "line_total": line_total, "area": area})

    discount_amount = Decimal(0)
    coupon = None
    if payload.coupon_code:
        coupon_result = await db.execute(select(Coupon).where(Coupon.code == payload.coupon_code.upper(), Coupon.is_active == True))
        coupon = coupon_result.scalar_one_or_none()
        if not coupon:
            raise HTTPException(status_code=400, detail="Invalid coupon code")
        if coupon.valid_until and coupon.valid_until < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Coupon has expired")
        if coupon.coupon_type == "percentage":
            discount_amount = (subtotal * coupon.value / 100).quantize(Decimal("0.01"))
            if coupon.max_discount_amount:
                discount_amount = min(discount_amount, coupon.max_discount_amount)
        else:
            discount_amount = min(coupon.value, subtotal)

    cgst_total = sgst_total = igst_total = Decimal(0)
    for od in order_items_data:
        item_taxable = od["line_total"] - (discount_amount * od["line_total"] / subtotal).quantize(Decimal("0.01"))
        c, s, i = calculate_gst(item_taxable, od["product"].gst_rate, is_interstate)
        cgst_total += c; sgst_total += s; igst_total += i

    taxable_amount = subtotal - discount_amount
    shipping_charge = Decimal(0)
    total_amount = taxable_amount + cgst_total + sgst_total + igst_total + shipping_charge

    order = Order(
        order_number=generate_order_number(), user_id=current_user.id,
        coupon_id=coupon.id if coupon else None,
        shipping_name=address.full_name, shipping_phone=address.phone,
        shipping_line1=address.line1, shipping_line2=address.line2,
        shipping_city=address.city, shipping_state=address.state,
        shipping_state_code=address.state_code, shipping_pincode=address.pincode,
        subtotal=subtotal, discount_amount=discount_amount,
        cgst_amount=cgst_total, sgst_amount=sgst_total, igst_amount=igst_total,
        shipping_charge=shipping_charge, total_amount=total_amount,
        is_interstate=is_interstate, payment_method=payload.payment_method,
        payment_status=PaymentStatus.pending, status=OrderStatus.placed, notes=payload.notes,
    )
    db.add(order)
    await db.flush()

    for od in order_items_data:
        db.add(OrderItem(
            order_id=order.id, variant_id=od["variant"].id,
            product_name=od["product"].name, variant_sku=od["variant"].sku,
            selected_attributes=od["variant"].selected_attributes,
            unit_price=od["unit_price"], quantity=od["item"].quantity,
            custom_width_ft=od["item"].custom_width_ft, custom_height_ft=od["item"].custom_height_ft,
            area_sqft=od["area"], line_total=od["line_total"],
        ))
        if od["variant"].track_inventory:
            od["variant"].stock_qty -= od["item"].quantity

    db.add(OrderTracking(order_id=order.id, status=OrderStatus.placed, message="Order placed successfully"))
    if coupon:
        coupon.used_count += 1
    for item in cart_items:
        await db.delete(item)

    return {"order_number": order.order_number, "total_amount": str(order.total_amount), "payment_method": order.payment_method}


@router.get("/")
async def my_orders(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.user_id == current_user.id).order_by(Order.created_at.desc()))
    return result.scalars().all()


@router.get("/{order_number}")
async def get_order(order_number: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).options(selectinload(Order.items), selectinload(Order.tracking))
        .where(Order.order_number == order_number, Order.user_id == current_user.id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


# ── Hook: auto-create invoice on order confirm ──
async def trigger_invoice_for_order(db, order):
    """Call this after COD order placement or payment verification."""
    try:
        from app.api.v1.endpoints.sales_invoices import create_invoice_from_order
        invoice = await create_invoice_from_order(db, order)
        print(f"✓ Invoice {invoice.invoice_number} created for order {order.order_number}")
    except Exception as e:
        print(f"Invoice creation failed for {order.order_number}: {e}")
