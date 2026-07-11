from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sa_func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, field_validator
from typing import Optional, List
from decimal import Decimal
from datetime import date

from app.db.session import get_db
from app.models.models import ProductVariant, Product, StockTransaction, StockTxnType, InternalUser, User
from app.models.pos import POSSale, POSSaleItem, POSPayment, POSSaleStatus, POSPaymentMethod
from app.api.v1.endpoints.shared_auth import require_roles, ActingUser
from app.services.journal_service import post_pos_sale_journal

router = APIRouter()


async def resolve_internal_user_id(db: AsyncSession, current_user) -> Optional[int]:
    """cashier_id / created_by_id (StockTransaction) both FK to internal_users.id.
    If this sale was created by a customer-admin login (not a real staff/
    internal_users row), there's no matching internal_users id — return None
    instead of a bad FK."""
    user_id = getattr(current_user, "id", None)
    if user_id is None:
        return None
    result = await db.execute(select(InternalUser).where(InternalUser.id == user_id))
    return user_id if result.scalar_one_or_none() else None


async def resolve_users_id(db: AsyncSession, current_user) -> Optional[int]:
    """Journal.created_by_id FKs to users.id (a different table than
    internal_users). Same problem, opposite direction — only set it if this
    id actually exists in the users table."""
    user_id = getattr(current_user, "id", None)
    if user_id is None:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return user_id if result.scalar_one_or_none() else None


# ══════════════════════════════════════════════════════════════════════════════
# PRODUCT LOOKUP — for the POS screen
# ══════════════════════════════════════════════════════════════════════════════
# NOTE: if you already have product search / barcode endpoints elsewhere,
# point the frontend at those instead and delete these two routes.

@router.get("/products/search")
async def search_products(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):
    result = await db.execute(
        select(ProductVariant)
        .join(Product)
        .options(selectinload(ProductVariant.product))
        .where((Product.name.ilike(f"%{q}%")) | (ProductVariant.sku.ilike(f"%{q}%")))
        .where(ProductVariant.is_active == True)
        .limit(20)
    )
    variants = result.scalars().all()
    return [
        {
            "variant_id": v.id, "sku": v.sku, "product_name": v.product.name,
            "retail_price": float(v.retail_price), "stock_qty": v.stock_qty,
        }
        for v in variants
    ]


@router.get("/products/barcode/{sku}")
async def lookup_by_barcode(
    sku: str,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):
    result = await db.execute(
        select(ProductVariant)
        .options(selectinload(ProductVariant.product))
        .where(ProductVariant.sku == sku)
    )
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(404, "Product not found for this barcode/SKU")
    return {
        "variant_id": variant.id, "sku": variant.sku, "product_name": variant.product.name,
        "retail_price": float(variant.retail_price), "stock_qty": variant.stock_qty,
    }


# ══════════════════════════════════════════════════════════════════════════════
# SALE NUMBER GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

async def next_sale_number(db: AsyncSession) -> str:
    today_str = date.today().strftime("%Y%m%d")
    count_r = await db.execute(
        select(sa_func.count(POSSale.id)).where(POSSale.sale_number.like(f"POS-{today_str}-%"))
    )
    count = count_r.scalar() or 0
    return f"POS-{today_str}-{count + 1:04d}"


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class POSSaleItemPayload(BaseModel):
    variant_id: int
    quantity: int
    unit_price: Optional[Decimal] = None  # falls back to variant.retail_price

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v):
        if v <= 0:
            raise ValueError("quantity must be greater than 0")
        return v


class POSPaymentPayload(BaseModel):
    method: POSPaymentMethod
    amount: Decimal


class POSSalePayload(BaseModel):
    items: List[POSSaleItemPayload]
    payments: List[POSPaymentPayload]
    discount_amount: Decimal = Decimal("0")
    notes: Optional[str] = None
    customer_id: Optional[int] = None
    walk_in_name: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# CREATE POS SALE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/sales", status_code=201)
async def create_pos_sale(
    payload: POSSalePayload,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):
    if not payload.items:
        raise HTTPException(400, "At least one item is required")
    if not payload.payments:
        raise HTTPException(400, "At least one payment is required")

    if payload.customer_id is not None:
        cust_r = await db.execute(
            select(User).where(User.id == payload.customer_id, User.role == "customer")
        )
        if not cust_r.scalar_one_or_none():
            raise HTTPException(400, "Selected customer not found")

    variant_ids = [i.variant_id for i in payload.items]
    var_r = await db.execute(
        select(ProductVariant)
        .options(selectinload(ProductVariant.product))
        .where(ProductVariant.id.in_(variant_ids))
    )
    variants = {v.id: v for v in var_r.scalars().all()}
    for item in payload.items:
        if item.variant_id not in variants:
            raise HTTPException(400, f"Variant id={item.variant_id} not found")

    # Stock check up front — fail fast before touching anything
    for item in payload.items:
        variant = variants[item.variant_id]
        if variant.track_inventory and variant.stock_qty < item.quantity:
            raise HTTPException(
                400,
                f"Insufficient stock for {variant.product.name} ({variant.sku}): "
                f"have {variant.stock_qty}, need {item.quantity}",
            )

    subtotal = Decimal("0")
    computed_items = []
    for item in payload.items:
        variant = variants[item.variant_id]
        unit_price = item.unit_price if item.unit_price is not None else variant.retail_price
        line_total = (unit_price * item.quantity).quantize(Decimal("0.01"))
        subtotal += line_total
        computed_items.append({
            "variant": variant, "quantity": item.quantity,
            "unit_price": unit_price, "line_total": line_total,
        })

    total_amount = subtotal - payload.discount_amount

    payments_total = sum(p.amount for p in payload.payments)
    if payments_total != total_amount:
        raise HTTPException(
            400,
            f"Payment total ({payments_total}) does not match sale total ({total_amount})",
        )

    internal_user_id = await resolve_internal_user_id(db, current_user)

    sale = POSSale(
        sale_number=await next_sale_number(db),
        subtotal=subtotal,
        discount_amount=payload.discount_amount,
        tax_amount=Decimal("0"),
        total_amount=total_amount,
        status=POSSaleStatus.completed,
        cashier_id=internal_user_id,
        customer_id=payload.customer_id,
        walk_in_name=payload.walk_in_name,
        notes=payload.notes,
    )
    db.add(sale)
    await db.flush()

    for line in computed_items:
        variant = line["variant"]
        db.add(POSSaleItem(
            pos_sale_id=sale.id, variant_id=variant.id,
            product_name=variant.product.name, variant_sku=variant.sku,
            quantity=line["quantity"], unit_price=line["unit_price"],
            line_total=line["line_total"],
        ))

        if variant.track_inventory:
            qty_before = variant.stock_qty
            variant.stock_qty -= line["quantity"]
            db.add(StockTransaction(
                variant_id=variant.id, txn_type=StockTxnType.out,
                qty_change=-line["quantity"], qty_before=qty_before, qty_after=variant.stock_qty,
                reference_type="pos_sale", reference_id=sale.sale_number,
                note=f"POS sale {sale.sale_number}",
                created_by_id=internal_user_id,
            ))

    for p in payload.payments:
        db.add(POSPayment(pos_sale_id=sale.id, method=p.method, amount=p.amount))

    await db.flush()

    users_id = await resolve_users_id(db, current_user)
    journal = await post_pos_sale_journal(
        db, sale,
        [{"method": p.method, "amount": p.amount} for p in payload.payments],
        created_by_user_id=users_id,
    )
    sale.journal_id = journal.id

    await db.commit()
    await db.refresh(sale)

    customer_display_name = "Cash Customer"
    if sale.customer_id is not None:
        name_r = await db.execute(select(User.name).where(User.id == sale.customer_id))
        customer_display_name = name_r.scalar_one_or_none() or "Cash Customer"
    elif sale.walk_in_name:
        customer_display_name = sale.walk_in_name

    return {
        "id": sale.id, "sale_number": sale.sale_number,
        "subtotal": float(sale.subtotal), "discount_amount": float(sale.discount_amount),
        "total_amount": float(sale.total_amount), "status": sale.status,
        "customer_id": sale.customer_id, "walk_in_name": sale.walk_in_name,
        "customer_display_name": customer_display_name,
        "items": [
            {
                "product_name": l["variant"].product.name, "sku": l["variant"].sku,
                "quantity": l["quantity"], "unit_price": float(l["unit_price"]),
                "line_total": float(l["line_total"]),
            }
            for l in computed_items
        ],
        "payments": [{"method": p.method, "amount": float(p.amount)} for p in payload.payments],
        "created_at": sale.created_at.isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# LIST / GET / VOID
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/sales")
async def list_pos_sales(
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
):
    query = select(POSSale).options(selectinload(POSSale.customer)).order_by(POSSale.created_at.desc())
    if from_date:
        query = query.where(POSSale.created_at >= from_date)
    if to_date:
        query = query.where(POSSale.created_at <= to_date)
    result = await db.execute(query.limit(200))
    sales = result.scalars().all()
    return [
        {
            "id": s.id, "sale_number": s.sale_number, "total_amount": float(s.total_amount),
            "status": s.status, "created_at": s.created_at.isoformat(),
            "customer_display_name": s.customer.name if s.customer else (s.walk_in_name or "Cash Customer"),
        }
        for s in sales
    ]


async def _finalize_sale(
    db: AsyncSession,
    sale: POSSale,
    computed_items: list,
    payments_payload: List[POSPaymentPayload],
    internal_user_id: Optional[int],
    users_id: Optional[int],
):
    """Runs stock check, stock deduction, payment rows, and journal posting
    for a sale that's about to become `completed`. Assumes sale.subtotal,
    discount_amount, total_amount are already set correctly by the caller."""

    payments_total = sum(p.amount for p in payments_payload)
    if payments_total != sale.total_amount:
        raise HTTPException(
            400,
            f"Payment total ({payments_total}) does not match sale total ({sale.total_amount})",
        )

    # Stock check up front — fail fast before touching anything
    for line in computed_items:
        variant = line["variant"]
        if variant.track_inventory and variant.stock_qty < line["quantity"]:
            raise HTTPException(
                400,
                f"Insufficient stock for {variant.product.name} ({variant.sku}): "
                f"have {variant.stock_qty}, need {line['quantity']}",
            )

    for line in computed_items:
        variant = line["variant"]
        if variant.track_inventory:
            qty_before = variant.stock_qty
            variant.stock_qty -= line["quantity"]
            db.add(StockTransaction(
                variant_id=variant.id, txn_type=StockTxnType.out,
                qty_change=-line["quantity"], qty_before=qty_before, qty_after=variant.stock_qty,
                reference_type="pos_sale", reference_id=sale.sale_number,
                note=f"POS sale {sale.sale_number}",
                created_by_id=internal_user_id,
            ))

    for p in payments_payload:
        db.add(POSPayment(pos_sale_id=sale.id, method=p.method, amount=p.amount))

    sale.status = POSSaleStatus.completed
    await db.flush()

    journal = await post_pos_sale_journal(
        db, sale,
        [{"method": p.method, "amount": p.amount} for p in payments_payload],
        created_by_user_id=users_id,
    )
    sale.journal_id = journal.id


class POSHoldPayload(BaseModel):
    items: List[POSSaleItemPayload]
    discount_amount: Decimal = Decimal("0")
    notes: Optional[str] = None
    customer_id: Optional[int] = None
    walk_in_name: Optional[str] = None

class POSHeldCheckoutPayload(BaseModel):
    items: List[POSSaleItemPayload]
    payments: List[POSPaymentPayload]
    discount_amount: Decimal = Decimal("0")
    customer_id: Optional[int] = None
    walk_in_name: Optional[str] = None


@router.post("/sales/hold", status_code=201)
async def hold_pos_sale(
    payload: POSHoldPayload,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):
    if not payload.items:
        raise HTTPException(400, "At least one item is required")

    variant_ids = [i.variant_id for i in payload.items]
    var_r = await db.execute(
        select(ProductVariant).options(selectinload(ProductVariant.product))
        .where(ProductVariant.id.in_(variant_ids))
    )
    variants = {v.id: v for v in var_r.scalars().all()}
    for item in payload.items:
        if item.variant_id not in variants:
            raise HTTPException(400, f"Variant id={item.variant_id} not found")

    subtotal = Decimal("0")
    computed_items = []
    for item in payload.items:
        variant = variants[item.variant_id]
        unit_price = item.unit_price if item.unit_price is not None else variant.retail_price
        line_total = (unit_price * item.quantity).quantize(Decimal("0.01"))
        subtotal += line_total
        computed_items.append({"variant": variant, "quantity": item.quantity,
                                "unit_price": unit_price, "line_total": line_total})

    total_amount = subtotal - payload.discount_amount
    internal_user_id = await resolve_internal_user_id(db, current_user)

    sale = POSSale(
        sale_number=await next_sale_number(db),
        subtotal=subtotal, discount_amount=payload.discount_amount,
        tax_amount=Decimal("0"), total_amount=total_amount,
        status=POSSaleStatus.held,
        cashier_id=internal_user_id, customer_id=payload.customer_id,
        walk_in_name=payload.walk_in_name, notes=payload.notes,
    )
    db.add(sale)
    await db.flush()

    for line in computed_items:
        variant = line["variant"]
        db.add(POSSaleItem(
            pos_sale_id=sale.id, variant_id=variant.id,
            product_name=variant.product.name, variant_sku=variant.sku,
            quantity=line["quantity"], unit_price=line["unit_price"],
            line_total=line["line_total"],
        ))
        # No stock deduction, no journal — sale is just parked

    await db.commit()
    await db.refresh(sale)
    return {"sale_number": sale.sale_number, "status": sale.status, "message": "Sale held"}


@router.get("/sales/held")
async def list_held_sales(
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):
    result = await db.execute(
        select(POSSale).options(selectinload(POSSale.customer))
        .where(POSSale.status == POSSaleStatus.held)
        .order_by(POSSale.created_at.desc())
    )
    sales = result.scalars().all()
    return [
        {
            "sale_number": s.sale_number, "total_amount": float(s.total_amount),
            "created_at": s.created_at.isoformat(),
            "customer_display_name": s.customer.name if s.customer else (s.walk_in_name or "Cash Customer"),
        }
        for s in sales
    ]


@router.get("/sales/held/{sale_number}")
async def get_held_sale(
    sale_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):
    result = await db.execute(
        select(POSSale).options(selectinload(POSSale.items))
        .where(POSSale.sale_number == sale_number, POSSale.status == POSSaleStatus.held)
    )
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(404, "Held sale not found")
    return {
        "sale_number": sale.sale_number,
        "discount_amount": float(sale.discount_amount),
        "customer_id": sale.customer_id, "walk_in_name": sale.walk_in_name,
        "notes": sale.notes,
        "items": [
            {"variant_id": i.variant_id, "sku": i.variant_sku, "product_name": i.product_name,
             "quantity": i.quantity, "unit_price": float(i.unit_price)}
            for i in sale.items
        ],
    }


@router.patch("/sales/held/{sale_number}")
async def update_held_sale(
    sale_number: str,
    payload: POSHoldPayload,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):
    result = await db.execute(
        select(POSSale).options(selectinload(POSSale.items))
        .where(POSSale.sale_number == sale_number, POSSale.status == POSSaleStatus.held)
    )
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(404, "Held sale not found")
    if not payload.items:
        raise HTTPException(400, "At least one item is required")

    variant_ids = [i.variant_id for i in payload.items]
    var_r = await db.execute(
        select(ProductVariant).options(selectinload(ProductVariant.product))
        .where(ProductVariant.id.in_(variant_ids))
    )
    variants = {v.id: v for v in var_r.scalars().all()}
    for item in payload.items:
        if item.variant_id not in variants:
            raise HTTPException(400, f"Variant id={item.variant_id} not found")

    # Replace items wholesale — simplest to reason about for add/remove edits
    for old_item in list(sale.items):
        await db.delete(old_item)
    await db.flush()

    subtotal = Decimal("0")
    for item in payload.items:
        variant = variants[item.variant_id]
        unit_price = item.unit_price if item.unit_price is not None else variant.retail_price
        line_total = (unit_price * item.quantity).quantize(Decimal("0.01"))
        subtotal += line_total
        db.add(POSSaleItem(
            pos_sale_id=sale.id, variant_id=variant.id,
            product_name=variant.product.name, variant_sku=variant.sku,
            quantity=item.quantity, unit_price=unit_price, line_total=line_total,
        ))

    sale.subtotal = subtotal
    sale.discount_amount = payload.discount_amount
    sale.total_amount = subtotal - payload.discount_amount
    sale.customer_id = payload.customer_id
    sale.walk_in_name = payload.walk_in_name
    sale.notes = payload.notes

    await db.commit()
    return {"sale_number": sale.sale_number, "message": "Held sale updated"}


@router.delete("/sales/held/{sale_number}", status_code=204)
async def discard_held_sale(
    sale_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):
    result = await db.execute(
        select(POSSale).where(POSSale.sale_number == sale_number, POSSale.status == POSSaleStatus.held)
    )
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(404, "Held sale not found")
    await db.delete(sale)  # cascades to items; nothing to reverse (no stock/journal touched)
    await db.commit()

@router.post("/sales/held/{sale_number}/checkout")
async def checkout_held_sale(
    sale_number: str,
    payload: POSHeldCheckoutPayload,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):
    result = await db.execute(
        select(POSSale).options(selectinload(POSSale.items))
        .where(POSSale.sale_number == sale_number, POSSale.status == POSSaleStatus.held)
    )
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(404, "Held sale not found")
    if not payload.items:
        raise HTTPException(400, "At least one item is required")
    if not payload.payments:
        raise HTTPException(400, "At least one payment is required")

    if payload.customer_id is not None:
        cust_r = await db.execute(
            select(User).where(User.id == payload.customer_id, User.role == "customer")
        )
        if not cust_r.scalar_one_or_none():
            raise HTTPException(400, "Selected customer not found")

    variant_ids = [i.variant_id for i in payload.items]
    var_r = await db.execute(
        select(ProductVariant).options(selectinload(ProductVariant.product))
        .where(ProductVariant.id.in_(variant_ids))
    )
    variants = {v.id: v for v in var_r.scalars().all()}
    for item in payload.items:
        if item.variant_id not in variants:
            raise HTTPException(400, f"Variant id={item.variant_id} not found")

    # Replace items on the held sale with whatever the cashier finalized with
    for old_item in list(sale.items):
        await db.delete(old_item)
    await db.flush()

    subtotal = Decimal("0")
    computed_items = []
    for item in payload.items:
        variant = variants[item.variant_id]
        unit_price = item.unit_price if item.unit_price is not None else variant.retail_price
        line_total = (unit_price * item.quantity).quantize(Decimal("0.01"))
        subtotal += line_total
        computed_items.append({
            "variant": variant, "quantity": item.quantity,
            "unit_price": unit_price, "line_total": line_total,
        })
        db.add(POSSaleItem(
            pos_sale_id=sale.id, variant_id=variant.id,
            product_name=variant.product.name, variant_sku=variant.sku,
            quantity=item.quantity, unit_price=unit_price, line_total=line_total,
        ))

    sale.subtotal = subtotal
    sale.discount_amount = payload.discount_amount
    sale.total_amount = subtotal - payload.discount_amount
    sale.customer_id = payload.customer_id
    sale.walk_in_name = payload.walk_in_name

    internal_user_id = await resolve_internal_user_id(db, current_user)
    users_id = await resolve_users_id(db, current_user)

    await _finalize_sale(db, sale, computed_items, payload.payments, internal_user_id, users_id)

    await db.commit()
    await db.refresh(sale)

    customer_display_name = "Cash Customer"
    if sale.customer_id is not None:
        name_r = await db.execute(select(User.name).where(User.id == sale.customer_id))
        customer_display_name = name_r.scalar_one_or_none() or "Cash Customer"
    elif sale.walk_in_name:
        customer_display_name = sale.walk_in_name

    return {
        "id": sale.id, "sale_number": sale.sale_number,
        "subtotal": float(sale.subtotal), "discount_amount": float(sale.discount_amount),
        "total_amount": float(sale.total_amount), "status": sale.status,
        "customer_id": sale.customer_id, "walk_in_name": sale.walk_in_name,
        "customer_display_name": customer_display_name,
        "items": [
            {
                "product_name": l["variant"].product.name, "sku": l["variant"].sku,
                "quantity": l["quantity"], "unit_price": float(l["unit_price"]),
                "line_total": float(l["line_total"]),
            }
            for l in computed_items
        ],
        "payments": [{"method": p.method, "amount": float(p.amount)} for p in payload.payments],
        "created_at": sale.created_at.isoformat(),
    }


@router.get("/sales/{sale_number}")
async def get_pos_sale(
    sale_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):
    result = await db.execute(
        select(POSSale)
        .options(selectinload(POSSale.items), selectinload(POSSale.payments), selectinload(POSSale.customer))
        .where(POSSale.sale_number == sale_number)
    )
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(404, "POS sale not found")
    return {
        "id": sale.id, "sale_number": sale.sale_number, "subtotal": float(sale.subtotal),
        "discount_amount": float(sale.discount_amount), "total_amount": float(sale.total_amount),
        "status": sale.status, "created_at": sale.created_at.isoformat(),
        "customer_display_name": sale.customer.name if sale.customer else (sale.walk_in_name or "Cash Customer"),
        "items": [
            {
                "product_name": i.product_name, "sku": i.variant_sku, "quantity": i.quantity,
                "unit_price": float(i.unit_price), "line_total": float(i.line_total),
            }
            for i in sale.items
        ],
        "payments": [{"method": p.method, "amount": float(p.amount)} for p in sale.payments],
    }


@router.post("/sales/{sale_number}/void")
async def void_pos_sale(
    sale_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    result = await db.execute(
        select(POSSale).options(selectinload(POSSale.items)).where(POSSale.sale_number == sale_number)
    )
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(404, "POS sale not found")
    if sale.status == POSSaleStatus.voided:
        raise HTTPException(400, "Sale already voided")

    internal_user_id = await resolve_internal_user_id(db, current_user)

    for item in sale.items:
        var_r = await db.execute(select(ProductVariant).where(ProductVariant.id == item.variant_id))
        variant = var_r.scalar_one_or_none()
        if variant and variant.track_inventory:
            qty_before = variant.stock_qty
            variant.stock_qty += item.quantity
            db.add(StockTransaction(
                variant_id=variant.id, txn_type=StockTxnType.in_,
                qty_change=item.quantity, qty_before=qty_before, qty_after=variant.stock_qty,
                reference_type="pos_void", reference_id=sale.sale_number,
                note=f"Void POS sale {sale.sale_number}",
                created_by_id=internal_user_id,
            ))

    sale.status = POSSaleStatus.voided
    await db.commit()
    return {"sale_number": sale.sale_number, "status": "voided"}

