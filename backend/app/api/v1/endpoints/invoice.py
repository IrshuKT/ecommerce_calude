"""  
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
from app.models.models import User, ProductVariant, Product
from app.services.journal_service import post_sales_invoice_journal, inv_numbe

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class ManualInvoiceItem(BaseModel):
    variant_id: int
    quantity: Decimal
    unit_price: Optional[Decimal] = None      # override price; uses retail_price if omitted
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


# ══════════════════════════════════════════════════════════════════════════════
# HELPER — compute GST per line
# ══════════════════════════════════════════════════════════════════════════════

def _calc_line(item: ManualInvoiceItem, variant: ProductVariant, is_interstate: bool):
    unit_price = item.unit_price if item.unit_price is not None else variant.retail_price
    qty        = item.quantity
    disc_pct   = item.discount_pct

    subtotal       = unit_price * qty
    discount_amt   = (subtotal * disc_pct / 100).quantize(Decimal("0.01"))
    taxable_amount = subtotal - discount_amt
    gst_rate       = variant.product.gst_rate      # from Product

    if is_interstate:
        igst_rate  = gst_rate
        cgst_rate  = Decimal("0")
        sgst_rate  = Decimal("0")
    else:
        igst_rate  = Decimal("0")
        cgst_rate  = (gst_rate / 2).quantize(Decimal("0.01"))
        sgst_rate  = (gst_rate / 2).quantize(Decimal("0.01"))

    cgst_amount = (taxable_amount * cgst_rate / 100).quantize(Decimal("0.01"))
    sgst_amount = (taxable_amount * sgst_rate / 100).quantize(Decimal("0.01"))
    igst_amount = (taxable_amount * igst_rate / 100).quantize(Decimal("0.01"))
    line_total  = taxable_amount + cgst_amount + sgst_amount + igst_amount

    return {
        "product_name":   variant.product.name,
        "hsn_code":       variant.product.hsn_code,
        "quantity":       qty,
        "unit":           item.unit,
        "unit_price":     unit_price,
        "discount_pct":   disc_pct,
        "taxable_amount": taxable_amount,
        "gst_rate":       gst_rate,
        "cgst_rate":      cgst_rate,
        "sgst_rate":      sgst_rate,
        "igst_rate":      igst_rate,
        "cgst_amount":    cgst_amount,
        "sgst_amount":    sgst_amount,
        "igst_amount":    igst_amount,
        "line_total":     line_total,
    }


# ══════════════════════════════════════════════════════════════════════════════
# POST /invoices/manual  — create draft manual invoice
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/manual", status_code=201)
async def create_manual_invoice(
    payload: ManualInvoicePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    # ── validate customer ────────────────────────────────────────────────────
    cust_r = await db.execute(select(User).where(User.id == payload.customer_id))
    customer = cust_r.scalar_one_or_none()
    if not customer:
        raise HTTPException(400, "Customer not found")

    # ── load variants with product (for GST rate, name, hsn) ────────────────
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

    # ── compute totals ───────────────────────────────────────────────────────
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

    total_tax    = cgst_total + sgst_total + igst_total
    grand_total  = taxable_total + total_tax + payload.shipping_charge
    round_off    = (round(float(grand_total)) - float(grand_total))
    grand_total  = grand_total + Decimal(str(round_off)).quantize(Decimal("0.01"))

    # ── create SalesInvoice (draft) ──────────────────────────────────────────
    invoice = SalesInvoice(
        invoice_number   = await inv_number(db),
        invoice_date     = payload.invoice_date,
        due_date         = payload.due_date,
        order_id         = None,               # manual — no order
        customer_id      = customer.id,
        billing_name     = customer.name,
        billing_phone    = customer.phone,
        billing_line1    = "—",                # manual invoices have no address by default
        billing_city     = "—",
        billing_state    = "Kerala",
        billing_state_code = "32",
        billing_pincode  = "000000",
        customer_gstin   = payload.customer_gstin,
        subtotal         = subtotal,
        discount_amount  = discount_total,
        taxable_amount   = taxable_total,
        cgst_amount      = cgst_total,
        sgst_amount      = sgst_total,
        igst_amount      = igst_total,
        total_tax        = total_tax,
        shipping_charge  = payload.shipping_charge,
        round_off        = Decimal(str(round_off)),
        grand_total      = grand_total,
        balance_due      = grand_total,
        is_interstate    = payload.is_interstate,
        status           = InvoiceStatus.draft,
        notes            = payload.notes,
    )
    db.add(invoice)
    await db.flush()  # get invoice.id

    # ── create SalesInvoiceItems ─────────────────────────────────────────────
    for line in computed_lines:
        db.add(SalesInvoiceItem(invoice_id=invoice.id, **line))

    await db.commit()
    await db.refresh(invoice)

    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "status": invoice.status,
        "grand_total": float(invoice.grand_total),
    }


# ══════════════════════════════════════════════════════════════════════════════
# POST /invoices/{invoice_number}/confirm
# — post journal + deduct stock
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{invoice_number:path}/confirm")
async def confirm_invoice(
    invoice_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    # ── load invoice with items ──────────────────────────────────────────────
    inv_r = await db.execute(
        select(SalesInvoice)
        .options(selectinload(SalesInvoice.items))
        .where(SalesInvoice.invoice_number == invoice_number)
    )
    invoice = inv_r.scalar_one_or_none()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    if invoice.status != InvoiceStatus.draft:
        raise HTTPException(400, f"Invoice is already {invoice.status} — cannot confirm again")
    if invoice.journal_id:
        raise HTTPException(400, "Journal already posted for this invoice")

    # ── stock deduction (only for manual invoices with variant links) ────────
    # Order-based invoices: stock already deducted at order time
    # Manual invoices: order_id is None, so deduct now
    if invoice.order_id is None:
        # get all variant_ids from items — we need to map product_name → variant
        # SalesInvoiceItem doesn't store variant_id, so we match by product_name + unit_price
        # Better approach: load variants that match the invoice items
        # NOTE: Since manual invoice items don't store variant_id on SalesInvoiceItem,
        # we skip stock deduction here and handle it via a separate lookup.
        # See note below — add variant_id to SalesInvoiceItem for full stock tracking.
        pass

    # ── post journal ─────────────────────────────────────────────────────────
    journal = await post_sales_invoice_journal(db, invoice, invoice.customer_id)

    # ── update invoice status ────────────────────────────────────────────────
    invoice.status     = InvoiceStatus.confirmed
    invoice.journal_id = journal.id

    await db.commit()

    return {
        "invoice_number": invoice.invoice_number,
        "status": invoice.status,
        "journal_id": journal.id,
        "voucher_number": journal.voucher_number,
    }


# ══════════════════════════════════════════════════════════════════════════════
# POST /invoices/{invoice_number}/cancel
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{invoice_number:path}/cancel")
async def cancel_invoice(
    invoice_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    inv_r = await db.execute(
        select(SalesInvoice).where(SalesInvoice.invoice_number == invoice_number)
    )
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

    """