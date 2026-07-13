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
from app.models.models import User,ProductVariant, StockTransaction
from app.services.journal_service import post_sales_return_journal, ret_number, cn_number
from app.api.v1.endpoints.auth import get_current_user, get_optional_current_user,oauth2_scheme
from app.api.v1.endpoints.shared_auth import require_roles, ActingUser, get_optional_staff_user
from app.core.security import decode_token


router = APIRouter()

class ReturnItemIn(BaseModel):
    variant_id: Optional[int]
    product_name: str
    hsn_code: Optional[str] = None
    quantity: Decimal
    unit_price: Decimal
    gst_rate: Decimal
    restock: bool = True

class CreateReturnRequest(BaseModel):
    invoice_number: Optional[str] = None
    reason: Optional[str] = None
    customer_id: Optional[int] = None  
    items: List[ReturnItemIn]

@router.post("/", status_code=201)
async def create_sales_return(
    payload: CreateReturnRequest,
    db: AsyncSession = Depends(get_db),
    staff: Optional[ActingUser] = Depends(get_optional_staff_user),
    current_user: Optional[User] = Depends(get_optional_current_user),  # from sales_invoices.py fix
):
    invoice = None
    invoice_id = None
    is_interstate = False
    customer_id = payload.customer_id

    if payload.invoice_number:
        result = await db.execute(select(SalesInvoice).where(SalesInvoice.invoice_number == payload.invoice_number))
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        is_staff = staff and staff.role in ("admin", "manager", "sales")
        is_owner = current_user and invoice.customer_id == current_user.id
        if not is_staff and not is_owner:
            raise HTTPException(status_code=403, detail="Access denied")

        invoice_id = invoice.id
        customer_id = invoice.customer_id
        is_interstate = invoice.is_interstate
    else:
        if not customer_id:
            raise HTTPException(status_code=400, detail="customer_id is required for manual returns")
        if not (staff and staff.role in ("admin", "manager", "sales")):
            raise HTTPException(status_code=403, detail="Only staff can create manual returns")
   

    sales_return = SalesReturn(return_number= await ret_number(db), return_date=date.today(),
        invoice_id=invoice_id, customer_id=customer_id,
        reason=payload.reason, status=ReturnStatus.requested)
    db.add(sales_return)
    await db.flush()
    subtotal = cgst_t = sgst_t = igst_t = Decimal("0")
    for item in payload.items:
        taxable = (item.unit_price * item.quantity).quantize(Decimal("0.01"))
        tax = (taxable * item.gst_rate / 100).quantize(Decimal("0.01"))
        half = (tax / 2).quantize(Decimal("0.01"))
        cgst = Decimal("0") if is_interstate else half
        sgst = Decimal("0") if is_interstate else (tax - half)
        igst = tax if is_interstate else Decimal("0")
        db.add(SalesReturnItem(return_id=sales_return.id, variant_id=item.variant_id, product_name=item.product_name,
            hsn_code=item.hsn_code, quantity=item.quantity, unit_price=item.unit_price,
            gst_rate=item.gst_rate, taxable_amount=taxable,
            cgst_amount=cgst, sgst_amount=sgst, igst_amount=igst,
            line_total=(taxable + tax).quantize(Decimal("0.01")), restock=item.restock))
        subtotal += taxable; cgst_t += cgst; sgst_t += sgst; igst_t += igst
    sales_return.subtotal = subtotal; sales_return.cgst_amount = cgst_t
    sales_return.sgst_amount = sgst_t; sales_return.igst_amount = igst_t
    sales_return.total_amount = subtotal + cgst_t + sgst_t + igst_t
    await db.commit()
    await db.refresh(sales_return)
    return {"return_number": sales_return.return_number, "status": sales_return.status}

@router.get("/")
async def list_returns(db: AsyncSession = Depends(get_db), current_user: ActingUser = Depends(require_roles("admin", "manager")), status: Optional[str] = None):
    query = select(SalesReturn).options(selectinload(SalesReturn.customer)).order_by(SalesReturn.return_date.desc())
    if status: query = query.where(SalesReturn.status == status)
    result = await db.execute(query)
    returns = result.scalars().all()
    return [
        {
            "id": r.id,
            "return_number": r.return_number,
            "return_date": r.return_date,
            "invoice_id": r.invoice_id,
            "customer_id": r.customer_id,
            "customer_name": r.customer.name if r.customer else None,
            "total_amount": r.total_amount,
            "credit_note_number": r.credit_note_number,
            "reason": r.reason,
            "status": r.status,
        }
        for r in returns
    ]

@router.patch("/{return_number:path}/approve")
async def approve_return(return_number: str, db: AsyncSession = Depends(get_db), current_user: ActingUser = Depends(require_roles("admin", "manager"))):
    result = await db.execute(select(SalesReturn).options(selectinload(SalesReturn.items)).where(SalesReturn.return_number == return_number))
    sales_return = result.scalar_one_or_none()
    if not sales_return: raise HTTPException(status_code=404, detail="Return not found")
    if sales_return.status != ReturnStatus.requested: raise HTTPException(status_code=400, detail="Already processed")

    for item in sales_return.items:
        if item.restock and item.variant_id:
            variant_result = await db.execute(select(ProductVariant).where(ProductVariant.id == item.variant_id))
            variant = variant_result.scalar_one_or_none()
            if variant:
                qty_before = variant.stock_qty
                variant.stock_qty += int(item.quantity)
                db.add(StockTransaction(
                    variant_id=variant.id, txn_type="in",
                    qty_change=int(item.quantity),
                    qty_before=qty_before, qty_after=variant.stock_qty,
                    reference_type="return", reference_id=sales_return.return_number,
                    note=f"Restocked from return {sales_return.return_number}",
                ))

    sales_return.credit_note_number = await cn_number(db)
    sales_return.status = ReturnStatus.approved
    journal = await post_sales_return_journal(db, sales_return, sales_return.customer_id)
    sales_return.journal_id = journal.id
    return {"message": "Return approved", "credit_note_number": sales_return.credit_note_number}


@router.patch("/{return_number:path}/reject")
async def reject_return(return_number: str, reason: Optional[str] = None, db: AsyncSession = Depends(get_db), current_user: ActingUser = Depends(require_roles("admin", "manager"))):   
    result = await db.execute(select(SalesReturn).where(SalesReturn.return_number == return_number))
    sr = result.scalar_one_or_none()
    if not sr: raise HTTPException(status_code=404, detail="Return not found")
    sr.status = ReturnStatus.rejected
    if reason: sr.notes = reason
    return {"message": "Return rejected"}

@router.get("/{return_number:path}")
async def get_return(
    return_number: str,
    db: AsyncSession = Depends(get_db),
    staff: Optional[ActingUser] = Depends(get_optional_staff_user),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    result = await db.execute(
        select(SalesReturn)
        .options(selectinload(SalesReturn.items), selectinload(SalesReturn.customer))
        .where(SalesReturn.return_number == return_number)
    )
    sales_return = result.scalar_one_or_none()
    if not sales_return:
        raise HTTPException(status_code=404, detail="Return not found")

    is_staff = staff and staff.role in ("admin", "manager", "sales")
    is_owner = current_user and sales_return.customer_id == current_user.id
    if not is_staff and not is_owner:
        raise HTTPException(status_code=403, detail="Access denied")
    return sales_return
