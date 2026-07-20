from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import date

from app.db.session import get_db
from app.models.accounting import SalesInvoice, SalesInvoiceItem, InvoiceStatus
from app.models.models import User, OrderItem, ProductVariant, Product
from app.api.v1.endpoints.auth import get_current_user,  oauth2_scheme
from app.services.journal_service import post_sales_invoice_journal, inv_number
from app.api.v1.endpoints.shared_auth import get_optional_staff_user, require_roles, ActingUser
from app.core.security import decode_token
from app.services.tax_utils import calc_line_tax
from app.models.pos import POSSale


router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# HELPER — create invoice from an order (called by orders.py on confirm)
# ══════════════════════════════════════════════════════════════════════════════

async def create_invoice_from_order(db: AsyncSession, order) -> SalesInvoice:
    items_result = await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))
    order_items = items_result.scalars().all()
    invoice = SalesInvoice(
        invoice_number=await inv_number(db), invoice_date=date.today(),
        order_id=order.id, customer_id=order.user_id,
        billing_name=order.shipping_name, billing_phone=order.shipping_phone,
        billing_line1=order.shipping_line1, billing_line2=order.shipping_line2,
        billing_city=order.shipping_city, billing_state=order.shipping_state,
        billing_state_code=order.shipping_state_code, billing_pincode=order.shipping_pincode,
        subtotal=order.subtotal, discount_amount=order.discount_amount,
        taxable_amount=order.subtotal - order.discount_amount,
        cgst_amount=order.cgst_amount, sgst_amount=order.sgst_amount, igst_amount=order.igst_amount,
        total_tax=order.cgst_amount + order.sgst_amount + order.igst_amount,
        shipping_charge=order.shipping_charge, round_off=Decimal("0.00"),
        grand_total=order.total_amount, balance_due=order.total_amount,
        is_interstate=order.is_interstate, status=InvoiceStatus.confirmed,
    )
    db.add(invoice)
    await db.flush()
    for oi in order_items:
        gst_rate = Decimal("18.00")
        taxable = oi.line_total / (1 + gst_rate / 100)
        tax = oi.line_total - taxable
        half = tax / 2
        db.add(SalesInvoiceItem(
            invoice_id=invoice.id, variant_id=oi.variant_id, product_name=oi.product_name,
            quantity=Decimal(str(oi.quantity)), unit="Sqft" if oi.area_sqft else "Nos",
            unit_price=oi.unit_price, taxable_amount=taxable.quantize(Decimal("0.01")),
            gst_rate=gst_rate,
            cgst_rate=Decimal("0") if order.is_interstate else Decimal("9"),
            sgst_rate=Decimal("0") if order.is_interstate else Decimal("9"),
            igst_rate=Decimal("18") if order.is_interstate else Decimal("0"),
            cgst_amount=Decimal("0") if order.is_interstate else half.quantize(Decimal("0.01")),
            sgst_amount=Decimal("0") if order.is_interstate else (tax - half).quantize(Decimal("0.01")),
            igst_amount=tax.quantize(Decimal("0.01")) if order.is_interstate else Decimal("0"),
            line_total=oi.line_total,
        ))
    await db.flush()
    journal = await post_sales_invoice_journal(db, invoice, order.user_id)
    invoice.journal_id = journal.id
    return invoice


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS — manual invoice
# ══════════════════════════════════════════════════════════════════════════════

class ManualInvoiceItem(BaseModel):
    variant_id: int
    quantity: Decimal
    unit_price: Optional[Decimal] = None
    discount_pct: Decimal = Decimal("0")
    unit: str = "Nos"


class ManualInvoicePayload(BaseModel):
    customer_id: int
    invoice_date: date
    due_date: Optional[date] = None
    is_interstate: bool = False
    customer_gstin: Optional[str] = None
    shipping_charge: Decimal = Decimal("0")
    notes: Optional[str] = None
    items: List[ManualInvoiceItem]


def _calc_line(item: ManualInvoiceItem, variant: ProductVariant, is_interstate: bool):
    unit_price = item.unit_price if item.unit_price is not None else variant.retail_price
    qty        = item.quantity
    disc_pct   = item.discount_pct

    subtotal       = unit_price * qty
    discount_amt   = (subtotal * disc_pct / 100).quantize(Decimal("0.01"))
    taxable_amount = subtotal - discount_amt
    gst_rate       = variant.product.gst_rate

    if is_interstate:
        igst_rate, cgst_rate, sgst_rate = gst_rate, Decimal("0"), Decimal("0")
    else:
        igst_rate = Decimal("0")
        cgst_rate = (gst_rate / 2).quantize(Decimal("0.01"))
        sgst_rate = (gst_rate / 2).quantize(Decimal("0.01"))

    cgst_amount = (taxable_amount * cgst_rate / 100).quantize(Decimal("0.01"))
    sgst_amount = (taxable_amount * sgst_rate / 100).quantize(Decimal("0.01"))
    igst_amount = (taxable_amount * igst_rate / 100).quantize(Decimal("0.01"))
    line_total  = taxable_amount + cgst_amount + sgst_amount + igst_amount

    return {
        "product_name": variant.product.name, "hsn_code": variant.product.hsn_code,
        "quantity": qty, "unit": item.unit, "unit_price": unit_price,
        "discount_pct": disc_pct, "taxable_amount": taxable_amount, "gst_rate": gst_rate,
        "cgst_rate": cgst_rate, "sgst_rate": sgst_rate, "igst_rate": igst_rate,
        "cgst_amount": cgst_amount, "sgst_amount": sgst_amount, "igst_amount": igst_amount,
        "line_total": line_total,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ROUTES — STATIC PATHS FIRST (order matters!)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/")
async def list_invoices(db: AsyncSession = Depends(get_db),
                         current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
                         status: Optional[str] = None,
                           from_date: Optional[date] = None,
                         to_date: Optional[date] = None, 
                         page: int = Query(1, ge=1),
                           limit: int = Query(20, le=100)):
    query = select(SalesInvoice).order_by(SalesInvoice.invoice_date.desc())
    if status: query = query.where(SalesInvoice.status == status)
    if from_date: query = query.where(SalesInvoice.invoice_date >= from_date)
    if to_date: query = query.where(SalesInvoice.invoice_date <= to_date)
    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    return result.scalars().all()


@router.get("/my")
async def my_invoices(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(SalesInvoice).where(SalesInvoice.customer_id == current_user.id).order_by(SalesInvoice.invoice_date.desc()))
    return result.scalars().all()


@router.post("/manual", status_code=201)
async def create_manual_invoice(
    payload: ManualInvoicePayload,
      db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):
    cust_r = await db.execute(select(User).where(User.id == payload.customer_id))
    customer = cust_r.scalar_one_or_none()
    if not customer:
        raise HTTPException(400, "Customer not found")

    variant_ids = [i.variant_id for i in payload.items]
    var_r = await db.execute(
        select(ProductVariant).options(selectinload(ProductVariant.product)).where(ProductVariant.id.in_(variant_ids))
    )
    variants = {v.id: v for v in var_r.scalars().all()}
    for item in payload.items:
        if item.variant_id not in variants:
            raise HTTPException(400, f"Variant id={item.variant_id} not found")

    computed_lines = []
    subtotal = discount_total = taxable_total = Decimal("0")
    cgst_total = sgst_total = igst_total = Decimal("0")
    for item in payload.items:
        variant = variants[item.variant_id]
        line = _calc_line(item, variant, payload.is_interstate)
        computed_lines.append(line)
        subtotal       += line["unit_price"] * line["quantity"]
        discount_total += (line["unit_price"] * line["quantity"] * line["discount_pct"] / 100).quantize(Decimal("0.01"))
        taxable_total  += line["taxable_amount"]
        cgst_total     += line["cgst_amount"]
        sgst_total     += line["sgst_amount"]
        igst_total     += line["igst_amount"]

    total_tax   = cgst_total + sgst_total + igst_total
    grand_total = taxable_total + total_tax + payload.shipping_charge
    round_off   = (round(float(grand_total)) - float(grand_total))
    grand_total = grand_total + Decimal(str(round_off)).quantize(Decimal("0.01"))

    invoice = SalesInvoice(
        invoice_number=await inv_number(db), invoice_date=payload.invoice_date, due_date=payload.due_date,
        order_id=None, customer_id=customer.id, billing_name=customer.name, billing_phone=customer.phone,
        billing_line1="—", billing_city="—", billing_state="Kerala", billing_state_code="32",
        billing_pincode="000000", customer_gstin=payload.customer_gstin,
        subtotal=subtotal, discount_amount=discount_total, taxable_amount=taxable_total,
        cgst_amount=cgst_total, sgst_amount=sgst_total, igst_amount=igst_total, total_tax=total_tax,
        shipping_charge=payload.shipping_charge, round_off=Decimal(str(round_off)),
        grand_total=grand_total, balance_due=grand_total, is_interstate=payload.is_interstate,
        status=InvoiceStatus.draft, notes=payload.notes,
    )
    db.add(invoice)
    await db.flush()
    for line in computed_lines:
        db.add(SalesInvoiceItem(invoice_id=invoice.id, **line))
    await db.commit()
    await db.refresh(invoice)
    return {"id": invoice.id, "invoice_number": invoice.invoice_number, "status": invoice.status, "grand_total": float(invoice.grand_total)}


@router.post("/{invoice_number:path}/confirm")
async def confirm_invoice(invoice_number: str,
                        db: AsyncSession = Depends(get_db),
                        current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    inv_r = await db.execute(select(SalesInvoice).options(selectinload(SalesInvoice.items)).where(SalesInvoice.invoice_number == invoice_number))
    invoice = inv_r.scalar_one_or_none()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    if invoice.status != InvoiceStatus.draft:
        raise HTTPException(400, f"Invoice is already {invoice.status} — cannot confirm again")
    if invoice.journal_id:
        raise HTTPException(400, "Journal already posted for this invoice")

    # ── Stock deduction (fails loudly, before journal is posted) ──
    from app.services.stock_service import record_stock_transaction
    for it in invoice.items:
        if not it.variant_id:
            continue  # no variant = free-text line, skip
        v_r = await db.execute(select(ProductVariant).where(ProductVariant.id == it.variant_id))
        variant = v_r.scalar_one_or_none()
        if not variant:
            continue
        if variant.track_inventory:
            try:
                await record_stock_transaction(
                    db=db, variant=variant, txn_type="out", qty=int(it.quantity),
                    reference_type="invoice", reference_id=invoice.invoice_number,
                    note="Stock out on manual invoice confirmation",
                    created_by_id=current_user.id,
                )
            except ValueError as e:
                raise HTTPException(400, f"Cannot confirm: {e} for variant {variant.sku}")

    journal = await post_sales_invoice_journal(db, invoice, invoice.customer_id)
    invoice.status = InvoiceStatus.confirmed
    invoice.journal_id = journal.id
    await db.commit()
    return {"invoice_number": invoice.invoice_number, "status": invoice.status, "journal_id": journal.id, "voucher_number": journal.voucher_number}

@router.post("/{invoice_number:path}/cancel")
async def cancel_invoice(invoice_number: str,
                        db: AsyncSession = Depends(get_db),
                        current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    inv_r = await db.execute(select(SalesInvoice).where(SalesInvoice.invoice_number == invoice_number))
    invoice = inv_r.scalar_one_or_none()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    if invoice.status in (InvoiceStatus.paid, InvoiceStatus.partially_paid):
        raise HTTPException(400, "Cannot cancel a paid invoice — create a sales return instead")
    if invoice.status == InvoiceStatus.cancelled:
        raise HTTPException(400, "Invoice already cancelled")
    invoice.status = InvoiceStatus.cancelled
    await db.commit()
    return {"invoice_number": invoice.invoice_number, "status": "cancelled"}


# ══════════════════════════════════════════════════════════════════════════════
# GENERIC CATCH-ALL — MUST BE LAST
# ══════════════════════════════════════════════════════════════════════════════

async def get_optional_current_user(token: Optional[str] = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> Optional[User]:
    if not token:
        return None
    payload = decode_token(token)
    if not payload or payload.get("type") == "internal":
        return None
    result = await db.execute(select(User).where(User.id == int(payload.get("sub"))))
    return result.scalar_one_or_none()


@router.get("/{invoice_number:path}")
async def get_invoice(
    invoice_number: str,
    db: AsyncSession = Depends(get_db),
    staff: Optional[ActingUser] = Depends(get_optional_staff_user),
    customer: Optional[User] = Depends(get_optional_current_user),
):
    result = await db.execute(select(SalesInvoice).options(selectinload(SalesInvoice.items)).where(SalesInvoice.invoice_number == invoice_number))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if staff and staff.role in ("admin", "manager", "sales"):
        return invoice
    if customer and invoice.customer_id == customer.id:
        return invoice
    raise HTTPException(status_code=403, detail="Access denied")

@router.get("/{invoice_number:path}")
async def get_invoice(invoice_number: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(SalesInvoice).options(selectinload(SalesInvoice.items)).where(SalesInvoice.invoice_number == invoice_number))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if current_user.role != "admin" and invoice.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return invoice


#Invoice from pos---------------

async def create_invoice_from_pos_sale(
    db: AsyncSession,
    sale,                       # POSSale, already flushed (has .id, .sale_number)
    computed_items: list,       # [{"variant": ProductVariant, "quantity": int, "unit_price": Decimal, "line_total": Decimal}, ...]
    cgst_amount: Decimal,
    sgst_amount: Decimal,
    journal_id: int,
) -> SalesInvoice:
    """POS sales are always treated as intrastate (POSSale has no
    is_interstate field — matches the CGST+SGST-only split pos.py already
    computes at checkout). The journal is NOT re-posted here — POS already
    posted its own via post_pos_sale_journal; this just records the same
    journal_id so the invoice and the ledger entry stay linked."""

    customer_name = "Cash Customer"
    customer_phone = "-"
    if sale.customer_id is not None:
        cust_r = await db.execute(select(User).where(User.id == sale.customer_id))
        customer = cust_r.scalar_one_or_none()
        if customer:
            customer_name = customer.name
            customer_phone = customer.phone or "-"
    elif sale.walk_in_name:
        customer_name = sale.walk_in_name

    taxable_total = sale.subtotal - sale.discount_amount - sale.tax_amount

    invoice = SalesInvoice(
        invoice_number=await inv_number(db), invoice_date=date.today(),
        order_id=None, pos_sale_id=sale.id, customer_id=sale.customer_id,
        billing_name=customer_name, billing_phone=customer_phone,
        billing_line1="—", billing_city="—", billing_state="Kerala", billing_state_code="32",
        billing_pincode="000000", customer_gstin=sale.gstin,
        subtotal=sale.subtotal, discount_amount=sale.discount_amount,
        taxable_amount=taxable_total,
        cgst_amount=cgst_amount, sgst_amount=sgst_amount, igst_amount=Decimal("0"),
        total_tax=sale.tax_amount,
        shipping_charge=Decimal("0"), round_off=Decimal("0.00"),
        grand_total=sale.total_amount,
        balance_due=Decimal("0"),          # POS is paid in full at checkout
        is_interstate=False, status=InvoiceStatus.confirmed,
        journal_id=journal_id,
    )
    db.add(invoice)
    await db.flush()

    for line in computed_items:
        variant = line["variant"]
        gst_rate = variant.product.gst_rate
        taxable_value, tax_amt = calc_line_tax(line["line_total"], gst_rate)
        half = (tax_amt / 2).quantize(Decimal("0.01"))
        db.add(SalesInvoiceItem(
            invoice_id=invoice.id, variant_id=variant.id, product_name=variant.product.name,
            quantity=Decimal(str(line["quantity"])), unit="Nos",
            unit_price=line["unit_price"], taxable_amount=taxable_value, gst_rate=gst_rate,
            cgst_rate=(gst_rate / 2).quantize(Decimal("0.01")),
            sgst_rate=(gst_rate / 2).quantize(Decimal("0.01")),
            igst_rate=Decimal("0"),
            cgst_amount=half, sgst_amount=(tax_amt - half).quantize(Decimal("0.01")),
            igst_amount=Decimal("0"),
            line_total=line["line_total"],
        ))
    await db.flush()
    return invoice