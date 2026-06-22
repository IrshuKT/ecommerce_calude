from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from decimal import Decimal
from datetime import date
from typing import Optional

from app.db.session import get_db
from app.models.accounting import SalesInvoice, SalesInvoiceItem, InvoiceStatus
from app.models.models import User, OrderItem
from app.api.v1.endpoints.auth import get_current_user, get_admin_user
from app.services.journal_service import post_sales_invoice_journal, inv_number

router = APIRouter()


async def create_invoice_from_order(db: AsyncSession, order) -> SalesInvoice:
    items_result = await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))
    order_items = items_result.scalars().all()
    invoice = SalesInvoice(
        invoice_number=inv_number(), invoice_date=date.today(),
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
            invoice_id=invoice.id, product_name=oi.product_name,
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


@router.get("/")
async def list_invoices(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_admin_user),
                        status: Optional[str] = None, from_date: Optional[date] = None,
                        to_date: Optional[date] = None, page: int = Query(1, ge=1), limit: int = Query(20, le=100)):
    query = select(SalesInvoice).order_by(SalesInvoice.invoice_date.desc())
    if status: query = query.where(SalesInvoice.status == status)
    if from_date: query = query.where(SalesInvoice.invoice_date >= from_date)
    if to_date: query = query.where(SalesInvoice.invoice_date <= to_date)
    result = await db.execute(query.offset((page-1)*limit).limit(limit))
    return result.scalars().all()


@router.get("/my")
async def my_invoices(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(SalesInvoice).where(SalesInvoice.customer_id == current_user.id).order_by(SalesInvoice.invoice_date.desc()))
    return result.scalars().all()


@router.get("/{invoice_number}")
async def get_invoice(invoice_number: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(SalesInvoice).options(selectinload(SalesInvoice.items)).where(SalesInvoice.invoice_number == invoice_number))
    invoice = result.scalar_one_or_none()
    if not invoice: raise HTTPException(status_code=404, detail="Invoice not found")
    if current_user.role != "admin" and invoice.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return invoice
