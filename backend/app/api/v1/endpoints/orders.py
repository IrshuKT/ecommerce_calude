from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
import random, string
from sqlalchemy import func
from app.db.session import get_db
from app.models.models import (Order, OrderItem, OrderTracking, CartItem, ProductVariant,
    Product, Address, Coupon, User, OrderStatus, PaymentMethod, PaymentStatus)
from app.api.v1.endpoints.auth import get_current_user
from app.core.config import settings
from app.models.models import OrderTracking
from app.services.journal_service import get_next_number
from app.api.v1.endpoints.shared_auth import get_acting_staff_user, require_roles, ActingUser


router = APIRouter()




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
            unit_price = (v.retail_price * area).quantize(Decimal("0.01"))
        else:
            area = None
        unit_price = v.retail_price
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
        order_number=await get_next_number(db, "ORD", "GS"), user_id=current_user.id,
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




# ── Hook: auto-create invoice on order confirm ──
async def trigger_invoice_for_order(db, order):
    """Call this after COD order placement or payment verification."""
    try:
        from app.api.v1.endpoints.sales_invoices import create_invoice_from_order
        invoice = await create_invoice_from_order(db, order)
        print(f"✓ Invoice {invoice.invoice_number} created for order {order.order_number}")
    except Exception as e:
        print(f"Invoice creation failed for {order.order_number}: {e}")

@router.get("/admin/all")
async def admin_all_orders(
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
):
    from sqlalchemy import select
    query = select(Order).order_by(Order.created_at.desc())
    if status:
        query = query.where(Order.status == status)
    
    from sqlalchemy import func
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()
    
    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    orders = result.scalars().all()
    
    return {
        "items": [
            {
                "id": o.id,
                "order_number": o.order_number,
                "shipping_name": o.shipping_name,
                "shipping_city": o.shipping_city,
                "total_amount": str(o.total_amount),
                "payment_method": o.payment_method,
                "payment_status": o.payment_status,
                "status": o.status,
                "created_at": o.created_at,
            }
            for o in orders
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }




@router.patch("/{order_number:path}/status")
async def update_order_status(
    order_number: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):

    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.order_number == order_number)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status
    new_status = payload.get("status", order.status)
    order.status = new_status

    db.add(OrderTracking(
        order_id=order.id,
        status=new_status,
        message=f"Status updated to {new_status}",
    ))

    invoice_result = None       # "created" | "exists" | "failed" | None
    invoice_number = None
    stock_result = None         # "deducted" | "failed" | None

    if new_status == "confirmed" and old_status != "confirmed":

        # ── 1. Invoice creation ─────────────────────
        try:
            from app.models.accounting import SalesInvoice
            inv_check = await db.execute(
                select(SalesInvoice).where(SalesInvoice.order_id == order.id)
            )
            existing_invoice = inv_check.scalar_one_or_none()
            if not existing_invoice:
                from app.api.v1.endpoints.sales_invoices import create_invoice_from_order
                invoice = await create_invoice_from_order(db, order)
                invoice_result = "created"
                invoice_number = invoice.invoice_number
                print(f"✓ Invoice {invoice.invoice_number} created for order {order.order_number}")
            else:
                invoice_result = "exists"
                invoice_number = existing_invoice.invoice_number
                print(f"Invoice already exists for order {order.order_number}")
        except Exception as e:
            invoice_result = "failed"
            print(f"Invoice creation failed: {e}")
            import traceback
            traceback.print_exc()

        # ── 2. Stock deduction ───────────────────
        try:
            from app.models.models import OrderItem, ProductVariant
            from app.services.stock_service import record_stock_transaction

            items_result = await db.execute(
                select(OrderItem).where(OrderItem.order_id == order.id)
            )
            order_items = items_result.scalars().all()

            for item in order_items:
                var_result = await db.execute(
                    select(ProductVariant).where(ProductVariant.id == item.variant_id)
                )
                variant = var_result.scalar_one_or_none()
                if not variant:
                    print(f"⚠ Variant {item.variant_id} not found, skipping")
                    continue
                try:
                    await record_stock_transaction(
                        db=db, variant=variant, txn_type="out", qty=int(item.quantity),
                        reference_type="order", reference_id=order.order_number,
                        note="Stock out on order confirmation", created_by_id=current_user.id,
                    )
                    print(f"✓ Stock deducted for variant {variant.sku}: -{item.quantity}")
                except ValueError as e:
                    print(f"⚠ Stock warning for variant {variant.sku}: {e}")
            stock_result = "deducted"
        except Exception as e:
            stock_result = "failed"
            print(f"Stock deduction failed: {e}")
            import traceback
            traceback.print_exc()

    await db.commit()
    return {
        "message": "Order status updated",
        "status": new_status,
        "invoice_result": invoice_result,
        "invoice_number": invoice_number,
        "stock_result": stock_result,
    }

@router.get("/admin/{order_number:path}")
async def admin_get_order(
    order_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.tracking))
        .where(Order.order_number == order_number)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.get("/{order_number:path}")
async def get_order(order_number: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).options(selectinload(Order.items), selectinload(Order.tracking))
        .where(Order.order_number == order_number, Order.user_id == current_user.id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


class EditOrderItemIn(BaseModel):
    variant_id: int
    quantity: int
    custom_width_ft: Optional[Decimal] = None
    custom_height_ft: Optional[Decimal] = None


class EditOrderRequest(BaseModel):
    address_id: int
    items: List[EditOrderItemIn]


@router.patch("/{order_number:path}/edit")
async def edit_order(
    order_number: str,
    payload: EditOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.order_number == order_number, Order.user_id == current_user.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.placed:
        raise HTTPException(status_code=400, detail="This order can no longer be edited")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Order must have at least one item")

    addr_result = await db.execute(
        select(Address).where(Address.id == payload.address_id, Address.user_id == current_user.id)
    )
    address = addr_result.scalar_one_or_none()
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    variant_ids = [i.variant_id for i in payload.items]
    var_result = await db.execute(
        select(ProductVariant)
        .options(selectinload(ProductVariant.product))
        .where(ProductVariant.id.in_(variant_ids))
    )
    variants = {v.id: v for v in var_result.scalars().all()}

    for item in payload.items:
        if item.variant_id not in variants:
            raise HTTPException(status_code=400, detail=f"Variant id={item.variant_id} not found")
        v = variants[item.variant_id]
        if v.track_inventory and v.stock_qty < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {v.product.name}")

    is_interstate = address.state_code != settings.STORE_STATE_CODE

    subtotal = Decimal(0)
    items_data = []
    for item in payload.items:
        v = variants[item.variant_id]
        p = v.product
        area = None
        if p.price_type == "per_sqft" and item.custom_width_ft and item.custom_height_ft:
            area = (item.custom_width_ft * item.custom_height_ft).quantize(Decimal("0.01"))
        unit_price = v.retail_price
        line_total = (unit_price * item.quantity).quantize(Decimal("0.01"))
        subtotal += line_total
        items_data.append({
            "variant": v, "product": p, "item": item,
            "unit_price": unit_price, "line_total": line_total, "area": area,
        })

    discount_amount = Decimal(0)
    if order.coupon_id:
        coupon_result = await db.execute(select(Coupon).where(Coupon.id == order.coupon_id))
        coupon = coupon_result.scalar_one_or_none()
        if coupon and coupon.is_active:
            if coupon.coupon_type == "percentage":
                discount_amount = (subtotal * coupon.value / 100).quantize(Decimal("0.01"))
                if coupon.max_discount_amount:
                    discount_amount = min(discount_amount, coupon.max_discount_amount)
            else:
                discount_amount = min(coupon.value, subtotal)

    cgst_total = sgst_total = igst_total = Decimal(0)
    for od in items_data:
        item_taxable = od["line_total"]
        if subtotal > 0 and discount_amount > 0:
            item_taxable -= (discount_amount * od["line_total"] / subtotal).quantize(Decimal("0.01"))
        c, s, i = calculate_gst(item_taxable, od["product"].gst_rate, is_interstate)
        cgst_total += c; sgst_total += s; igst_total += i

    taxable_amount = subtotal - discount_amount
    total_amount = taxable_amount + cgst_total + sgst_total + igst_total + order.shipping_charge

    order.shipping_name = address.full_name
    order.shipping_phone = address.phone
    order.shipping_line1 = address.line1
    order.shipping_line2 = address.line2
    order.shipping_city = address.city
    order.shipping_state = address.state
    order.shipping_state_code = address.state_code
    order.shipping_pincode = address.pincode
    order.subtotal = subtotal
    order.discount_amount = discount_amount
    order.cgst_amount = cgst_total
    order.sgst_amount = sgst_total
    order.igst_amount = igst_total
    order.total_amount = total_amount
    order.is_interstate = is_interstate

    for old_item in order.items:
        await db.delete(old_item)
    await db.flush()

    for od in items_data:
        db.add(OrderItem(
            order_id=order.id, variant_id=od["variant"].id,
            product_name=od["product"].name, variant_sku=od["variant"].sku,
            selected_attributes=od["variant"].selected_attributes,
            unit_price=od["unit_price"], quantity=od["item"].quantity,
            custom_width_ft=od["item"].custom_width_ft, custom_height_ft=od["item"].custom_height_ft,
            area_sqft=od["area"], line_total=od["line_total"],
        ))

    db.add(OrderTracking(order_id=order.id, status=order.status, message="Order edited by customer"))
    await db.commit()
    return {"order_number": order.order_number, "total_amount": str(order.total_amount), "message": "Order updated"}