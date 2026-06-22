from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import date
from app.db.session import get_db
from app.models.accounting import SalesInvoice, SalesReturn, SalesReturnItem, ReturnStatus, InvoiceStatus
from app.models.models import User
from app.api.v1.endpoints.auth import get_current_user, get_admin_user
from app.services.journal_service import post_sales_return_journal, ret_number, cn_number

router = APIRouter()

class ReturnItemIn(BaseModel):
    product_name: str
    hsn_code: Optional[str] = None
    quantity: Decimal
    unit_price: Decimal
    gst_rate: Decimal
    restock: bool = True

class CreateReturnRequest(BaseModel):
    invoice_number: str
    reason: Optional[str] = None
    items: List[ReturnItemIn]

@router.post("/", status_code=201)
async def create_sales_return(payload: CreateReturnRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(SalesInvoice).where(SalesInvoice.invoice_number == payload.invoice_number))
    invoice = result.scalar_one_or_none()
    if not invoice: raise HTTPException(status_code=404, detail="Invoice not found")
    if current_user.role != "admin" and invoice.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    sales_return = SalesReturn(return_number=ret_number(), return_date=date.today(),
        invoice_id=invoice.id, customer_id=invoice.customer_id,
        reason=payload.reason, status=ReturnStatus.requested)
    db.add(sales_return)
    await db.flush()
    subtotal = cgst_t = sgst_t = igst_t = Decimal("0")
    for item in payload.items:
        taxable = (item.unit_price * item.quantity).quantize(Decimal("0.01"))
        tax = (taxable * item.gst_rate / 100).quantize(Decimal("0.01"))
        half = (tax / 2).quantize(Decimal("0.01"))
        cgst = Decimal("0") if invoice.is_interstate else half
        sgst = Decimal("0") if invoice.is_interstate else (tax - half)
        igst = tax if invoice.is_interstate else Decimal("0")
        db.add(SalesReturnItem(return_id=sales_return.id, product_name=item.product_name,
            hsn_code=item.hsn_code, quantity=item.quantity, unit_price=item.unit_price,
            gst_rate=item.gst_rate, taxable_amount=taxable,
            cgst_amount=cgst, sgst_amount=sgst, igst_amount=igst,
            line_total=(taxable + tax).quantize(Decimal("0.01")), restock=item.restock))
        subtotal += taxable; cgst_t += cgst; sgst_t += sgst; igst_t += igst
    sales_return.subtotal = subtotal; sales_return.cgst_amount = cgst_t
    sales_return.sgst_amount = sgst_t; sales_return.igst_amount = igst_t
    sales_return.total_amount = subtotal + cgst_t + sgst_t + igst_t
    return {"return_number": sales_return.return_number, "status": sales_return.status}

@router.get("/")
async def list_returns(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_admin_user), status: Optional[str] = None):
    query = select(SalesReturn).order_by(SalesReturn.return_date.desc())
    if status: query = query.where(SalesReturn.status == status)
    result = await db.execute(query)
    return result.scalars().all()

@router.patch("/{return_number}/approve")
async def approve_return(return_number: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_admin_user)):
    result = await db.execute(select(SalesReturn).options(selectinload(SalesReturn.items)).where(SalesReturn.return_number == return_number))
    sales_return = result.scalar_one_or_none()
    if not sales_return: raise HTTPException(status_code=404, detail="Return not found")
    if sales_return.status != ReturnStatus.requested: raise HTTPException(status_code=400, detail="Already processed")
    sales_return.credit_note_number = cn_number()
    sales_return.status = ReturnStatus.approved
    journal = await post_sales_return_journal(db, sales_return, sales_return.customer_id)
    sales_return.journal_id = journal.id
    return {"message": "Return approved", "credit_note_number": sales_return.credit_note_number}

@router.patch("/{return_number}/reject")
async def reject_return(return_number: str, reason: Optional[str] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_admin_user)):
    result = await db.execute(select(SalesReturn).where(SalesReturn.return_number == return_number))
    sr = result.scalar_one_or_none()
    if not sr: raise HTTPException(status_code=404, detail="Return not found")
    sr.status = ReturnStatus.rejected
    if reason: sr.notes = reason
    return {"message": "Return rejected"}
