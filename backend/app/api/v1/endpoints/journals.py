from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.db.session import get_db
from app.models.accounting import (Journal, JournalLine, Account, Vendor, VoucherType, SalesInvoice,SalesReturn,ReceiptVoucher,
Purchase,PurchaseReturn,PaymentVoucher)
from app.models.models import User
from app.api.v1.endpoints.shared_auth import require_roles, ActingUser


router = APIRouter()


class OpeningBalanceEntry(BaseModel):
    party_type: str         
    party_id: int
    amount: float            
    as_of_date: date
    narration: Optional[str] = None
 
 
class OpeningBalanceBulkPayload(BaseModel):
    entries: list[OpeningBalanceEntry]
    as_of_date: date         # global date (can be overridden per entry)
 
 
@router.post("/opening-balances", status_code=201)
async def create_opening_balances(
    payload: OpeningBalanceBulkPayload,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    """
    Post opening balances for customers and/or vendors.
 
    Customer opening balance journal:
        DR  1200 Accounts Receivable   (customer_id tagged)
        CR  3900 Opening Balance Equity
 
    Vendor opening balance journal:
        DR  3900 Opening Balance Equity
        CR  2100 Accounts Payable      (vendor_id tagged)
    """
    from app.services.journal_service import post_journal
 
    # ── Fetch required accounts ──────────────────────────────────────────────
    ar_result  = await db.execute(select(Account).where(Account.code == "1200"))
    ap_result  = await db.execute(select(Account).where(Account.code == "2100"))
    eq_result  = await db.execute(select(Account).where(Account.code == "3900"))
 
    ar_account = ar_result.scalar_one_or_none()
    ap_account = ap_result.scalar_one_or_none()
    eq_account = eq_result.scalar_one_or_none()
 
    if not ar_account:
        raise HTTPException(400, "Account 1200 (Accounts Receivable) not found")
    if not ap_account:
        raise HTTPException(400, "Account 2100 (Accounts Payable) not found")
    if not eq_account:
        from app.models.accounting import AccountType
        eq_account = Account(
            code="3900",
            name="Opening Balance Equity",
            account_type=AccountType.equity,
            is_system=True,
            is_active=True,
        )
        db.add(eq_account)
        await db.flush()  # assigns eq_account.id before use below
 
    results = []
 
    for entry in payload.entries:
        entry_date = entry.as_of_date or payload.as_of_date
 
        if entry.party_type == "customer":
            # Validate customer exists
            from app.models.models import User as UserModel
            cust_r = await db.execute(
                select(UserModel).where(UserModel.id == entry.party_id)
            )
            customer = cust_r.scalar_one_or_none()
            if not customer:
                raise HTTPException(400, f"Customer id={entry.party_id} not found")
 
            # Check duplicate
            dup = await db.execute(
                select(JournalLine).join(Journal).where(
                    Journal.voucher_type == VoucherType.opening_balance,
                    JournalLine.customer_id == entry.party_id,
                    JournalLine.account_id == ar_account.id,
                )
            )
            if dup.scalar_one_or_none():
                raise HTTPException(
                    400,
                    f"Opening balance already posted for customer '{customer.name}'. "
                    "Delete the existing journal entry first."
                )
 
            narration = entry.narration or f"Opening balance - {customer.name}"
 
            lines = [
                # DR Accounts Receivable (tagged to customer)
                {
                    "account_code": ar_account.code,
                    "debit": entry.amount,
                    "credit": 0,
                    "narration": narration,
                    "customer_id": entry.party_id,
                },
                # CR Opening Balance Equity
                {
                    "account_code": eq_account.code,
                    "debit": 0,
                    "credit": entry.amount,
                    "narration": narration,
                },
            ]
 
        elif entry.party_type == "vendor":
            # Validate vendor exists
            vend_r = await db.execute(
                select(Vendor).where(Vendor.id == entry.party_id)
            )
            vendor = vend_r.scalar_one_or_none()
            if not vendor:
                raise HTTPException(400, f"Vendor id={entry.party_id} not found")
 
            # Check duplicate
            dup = await db.execute(
                select(JournalLine).join(Journal).where(
                    Journal.voucher_type == VoucherType.opening_balance,
                    JournalLine.vendor_id == entry.party_id,
                    JournalLine.account_id == ap_account.id,
                )
            )
            if dup.scalar_one_or_none():
                raise HTTPException(
                    400,
                    f"Opening balance already posted for vendor '{vendor.name}'. "
                    "Delete the existing journal entry first."
                )
 
            narration = entry.narration or f"Opening balance - {vendor.name}"
 
            lines = [
                # DR Opening Balance Equity
                {
                    "account_code": eq_account.code,
                    "debit": entry.amount,
                    "credit": 0,
                    "narration": narration,
                },
                # CR Accounts Payable (tagged to vendor)
                {
                    "account_code": ap_account.code,
                    "debit": 0,
                    "credit": entry.amount,
                    "narration": narration,
                    "vendor_id": entry.party_id,
                },
            ]
 
        else:
            raise HTTPException(400, f"party_type must be 'customer' or 'vendor', got '{entry.party_type}'")
 
        journal = await post_journal(
            db=db,
            voucher_type=VoucherType.opening_balance,
            voucher_date=entry_date,
            lines=lines,
            reference=f"OB-{entry.party_type.upper()}-{entry.party_id}",
            narration=narration,
            created_by_id=current_user.id,
        )
 
        results.append({
            "party_type": entry.party_type,
            "party_id": entry.party_id,
            "amount": entry.amount,
            "journal_id": journal.id,
            "voucher_number": journal.voucher_number,
        })
 
    await db.commit()
    return {"posted": len(results), "entries": results}
 
 
@router.get("/opening-balances")
async def list_opening_balances(
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    """List all posted opening balance journals with party info."""
    from app.models.models import User as UserModel
 
    result = await db.execute(
        select(Journal)
        .options(
            selectinload(Journal.lines).selectinload(JournalLine.account)
        )
        .where(Journal.voucher_type == VoucherType.opening_balance)
        .order_by(Journal.voucher_date.desc())
    )
    journals = result.scalars().all()
 
    output = []
    for j in journals:
        for line in j.lines:
            # Only show the AR/AP line (has party tag), skip equity line
            if line.customer_id:
                cust = await db.execute(
                    select(UserModel).where(UserModel.id == line.customer_id)
                )
                party = cust.scalar_one_or_none()
                output.append({
                    "journal_id": j.id,
                    "voucher_number": j.voucher_number,
                    "voucher_date": str(j.voucher_date),
                    "party_type": "customer",
                    "party_id": line.customer_id,
                    "party_name": party.name if party else "Unknown",
                    "amount": float(line.debit),  # AR is debit
                    "narration": j.narration,
                })
            elif line.vendor_id:
                vend = await db.execute(
                    select(Vendor).where(Vendor.id == line.vendor_id)
                )
                party = vend.scalar_one_or_none()
                output.append({
                    "journal_id": j.id,
                    "voucher_number": j.voucher_number,
                    "voucher_date": str(j.voucher_date),
                    "party_type": "vendor",
                    "party_id": line.vendor_id,
                    "party_name": party.name if party else "Unknown",
                    "amount": float(line.credit),  # AP is credit
                    "narration": j.narration,
                })
 
    return output
 
 
@router.delete("/opening-balances/{journal_id}", status_code=204)
async def delete_opening_balance(
    journal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    """Delete an opening balance journal entry."""
    result = await db.execute(
        select(Journal).where(
            Journal.id == journal_id,
            Journal.voucher_type == VoucherType.opening_balance,
        )
    )
    journal = result.scalar_one_or_none()
    if not journal:
        raise HTTPException(404, "Opening balance journal not found")
 
    await db.delete(journal)
    await db.commit()



@router.get("/")
async def list_journals(
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    voucher_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=200),
):
    query = (
        select(Journal)
        .options(selectinload(Journal.lines).selectinload(JournalLine.account))
        .order_by(Journal.voucher_date.desc(), Journal.id.desc())
    )
    if from_date: query = query.where(Journal.voucher_date >= from_date)
    if to_date: query = query.where(Journal.voucher_date <= to_date)
    if voucher_type: query = query.where(Journal.voucher_type == voucher_type)

    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    journals = result.scalars().all()

    return [
        {
            "id": j.id,
            "voucher_number": j.voucher_number,
            "voucher_type": j.voucher_type,
            "voucher_date": j.voucher_date,
            "reference": j.reference,
            "narration": j.narration,
            "is_posted": j.is_posted,
            "created_at": j.created_at,
            "lines": [
                {
                    "id": l.id,
                    "account_id": l.account_id,
                    "account": {"code": l.account.code, "name": l.account.name} if l.account else None,
                    "debit": str(l.debit),
                    "credit": str(l.credit),
                    "narration": l.narration,
                }
                for l in j.lines
            ]
        }
        for j in journals
    ]


@router.post("/", status_code=201)
async def create_manual_journal(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    from app.services.journal_service import post_journal
    from app.models.accounting import VoucherType
    import datetime

    # validate voucher_type
    vtype_str = payload.get("voucher_type", "journal")
    try:
        voucher_type = VoucherType(vtype_str)
    except ValueError:
        voucher_type = VoucherType.journal

    voucher_date = datetime.date.fromisoformat(payload["voucher_date"])

    # resolve account_id → account_code if frontend sends id
    lines = payload["lines"]
    if lines and "account_id" in lines[0] and "account_code" not in lines[0]:
        from app.models.accounting import Account
        ids = [l["account_id"] for l in lines]
        result = await db.execute(select(Account).where(Account.id.in_(ids)))
        acc_map = {a.id: a.code for a in result.scalars().all()}
        lines = [{**l, "account_code": acc_map[l["account_id"]]} for l in lines]

    journal = await post_journal(
        db=db,
        voucher_type=voucher_type,
        voucher_date=voucher_date,
        lines=lines,
        reference=payload.get("reference"),
        narration=payload.get("narration"),
        created_by_id=current_user.id,
    )
    await db.commit()
    return {"id": journal.id, "voucher_number": journal.voucher_number}

# Accounts list endpoint
@router.get("/accounts", include_in_schema=False)
async def list_accounts_for_journal(
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    from app.models.accounting import Account
    result = await db.execute(
        select(Account).where(Account.is_active == True).order_by(Account.code)
    )
    accounts = result.scalars().all()
    return [{"id": a.id, "code": a.code, "name": a.name, "account_type": a.account_type} for a in accounts]


class AccountIn(BaseModel):
    code: str
    name: str
    account_type: str
    parent_code: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True

@router.get("/accounts/all")
async def list_all_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    result = await db.execute(
        select(Account).order_by(Account.code)
    )
    accounts = result.scalars().all()
    return [
        {
            "id": a.id,
            "code": a.code,
            "name": a.name,
            "account_type": a.account_type,
            "parent_id": a.parent_id,
            "is_system": a.is_system,
            "is_active": a.is_active,
            "description": a.description,
        }
        for a in accounts
    ]

@router.post("/accounts", status_code=201)
async def create_account(
    payload: AccountIn,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    # check duplicate code
    existing = await db.execute(select(Account).where(Account.code == payload.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Account code already exists")

    from app.models.accounting import AccountType
    account = Account(
        code=payload.code,
        name=payload.name,
        account_type=AccountType(payload.account_type),
        description=payload.description,
        is_active=payload.is_active,
        is_system=False,
    )
    if payload.parent_code:
        pr = await db.execute(select(Account).where(Account.code == payload.parent_code))
        parent = pr.scalar_one_or_none()
        if parent:
            account.parent_id = parent.id

    db.add(account)
    await db.commit()
    await db.refresh(account)
    return {"id": account.id, "code": account.code, "name": account.name}

@router.patch("/accounts/{account_id}")
async def update_account(
    account_id: int,
    payload: AccountIn,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.is_system:
        raise HTTPException(status_code=400, detail="Cannot edit system accounts")

    from app.models.accounting import AccountType
    account.name = payload.name
    account.account_type = AccountType(payload.account_type)
    account.description = payload.description
    account.is_active = payload.is_active

    if payload.parent_code:
        pr = await db.execute(select(Account).where(Account.code == payload.parent_code))
        parent = pr.scalar_one_or_none()
        if parent:
            account.parent_id = parent.id
    else:
        account.parent_id = None

    await db.commit()
    return {"id": account.id, "code": account.code, "name": account.name}

@router.delete("/accounts/{account_id}", status_code=204)
async def delete_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system accounts")
    await db.delete(account)
    await db.commit()



@router.get("/statement/customer/{customer_id}")
async def customer_statement(
    customer_id: int,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    from app.models.models import User as UserModel
 
    r = await db.execute(select(UserModel).where(UserModel.id == customer_id))
    customer = r.scalar_one_or_none()
    if not customer:
        raise HTTPException(404, "Customer not found")
 
    transactions = []
 
    # ── Opening Balance (from JournalLine with customer_id + voucher_type) ───
    ob_q = (
        select(JournalLine, Journal)
        .join(Journal, JournalLine.journal_id == Journal.id)
        .where(
            Journal.voucher_type == VoucherType.opening_balance,
            JournalLine.customer_id == customer_id,
        )
    )
    ob_result = await db.execute(ob_q)
    for line, journal in ob_result.all():
        transactions.append({
            "date": journal.voucher_date,
            "type": "Opening Balance",
            "reference": journal.voucher_number,
            "debit": float(line.debit),
            "credit": float(line.credit),
            "status": "posted",
        })
 
    # ── Sales Invoices ───────────────────────────────────────────────────────
    q = select(SalesInvoice).where(SalesInvoice.customer_id == customer_id)
    if from_date: q = q.where(SalesInvoice.invoice_date >= from_date)
    if to_date:   q = q.where(SalesInvoice.invoice_date <= to_date)
    invoices = (await db.execute(q)).scalars().all()
    for inv in invoices:
        transactions.append({
            "date": inv.invoice_date,
            "type": "Sales Invoice",
            "reference": inv.invoice_number,
            "debit": float(inv.grand_total),
            "credit": 0,
            "status": inv.status,
        })
 
    # ── Sales Returns ────────────────────────────────────────────────────────
    q = select(SalesReturn).where(SalesReturn.customer_id == customer_id)
    if from_date: q = q.where(SalesReturn.return_date >= from_date)
    if to_date:   q = q.where(SalesReturn.return_date <= to_date)
    returns = (await db.execute(q)).scalars().all()
    for ret in returns:
        transactions.append({
            "date": ret.return_date,
            "type": "Sales Return",
            "reference": ret.return_number,
            "debit": 0,
            "credit": float(ret.total_amount),
            "status": ret.status,
        })
 
    # ── Receipts ─────────────────────────────────────────────────────────────
    q = select(ReceiptVoucher).where(ReceiptVoucher.customer_id == customer_id)
    if from_date: q = q.where(ReceiptVoucher.receipt_date >= from_date)
    if to_date:   q = q.where(ReceiptVoucher.receipt_date <= to_date)
    receipts = (await db.execute(q)).scalars().all()
    for rec in receipts:
        transactions.append({
            "date": rec.receipt_date,
            "type": "Receipt",
            "reference": rec.receipt_number,
            "debit": 0,
            "credit": float(rec.amount),
            "status": "received",
        })
 
    # ── Sort & running balance ────────────────────────────────────────────────
    # Opening balance always first, then by date
    transactions.sort(key=lambda x: (0 if x["type"] == "Opening Balance" else 1, x["date"]))
 
    balance = 0.0
    for t in transactions:
        balance += t["debit"] - t["credit"]
        t["balance"] = round(balance, 2)
        t["date"] = str(t["date"])
 
    return {
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "email": customer.email,
            "phone": customer.phone,
        },
        "transactions": transactions,
        "summary": {
            "opening_balance": round(
                sum(t["debit"] - t["credit"] for t in transactions if t["type"] == "Opening Balance"), 2
            ),
            "total_invoiced": round(sum(t["debit"] for t in transactions if t["type"] == "Sales Invoice"), 2),
            "total_returns":  round(sum(t["credit"] for t in transactions if t["type"] == "Sales Return"), 2),
            "total_received": round(sum(t["credit"] for t in transactions if t["type"] == "Receipt"), 2),
            "closing_balance": round(balance, 2),
        }
    }
 
 
# ══════════════════════════════════════════════════════════════════════════════
# UPDATED vendor_statement — replace existing one in journals.py
# ══════════════════════════════════════════════════════════════════════════════
 
@router.get("/statement/vendor/{vendor_id}")
async def vendor_statement(
    vendor_id: int,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    r = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = r.scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
 
    transactions = []
 
    # ── Opening Balance ───────────────────────────────────────────────────────
    ob_q = (
        select(JournalLine, Journal)
        .join(Journal, JournalLine.journal_id == Journal.id)
        .where(
            Journal.voucher_type == VoucherType.opening_balance,
            JournalLine.vendor_id == vendor_id,
        )
    )
    ob_result = await db.execute(ob_q)
    for line, journal in ob_result.all():
        transactions.append({
            "date": journal.voucher_date,
            "type": "Opening Balance",
            "reference": journal.voucher_number,
            "debit": float(line.debit),
            "credit": float(line.credit),   # AP line is credit
            "status": "posted",
        })
 
    # ── Purchases ─────────────────────────────────────────────────────────────
    q = select(Purchase).where(Purchase.vendor_id == vendor_id)
    if from_date: q = q.where(Purchase.purchase_date >= from_date)
    if to_date:   q = q.where(Purchase.purchase_date <= to_date)
    purchases = (await db.execute(q)).scalars().all()
    for p in purchases:
        transactions.append({
            "date": p.purchase_date,
            "type": "Purchase",
            "reference": p.purchase_number,
            "debit": 0,
            "credit": float(p.grand_total),
            "status": p.status,
        })
 
    # ── Purchase Returns ──────────────────────────────────────────────────────
    q = select(PurchaseReturn).where(PurchaseReturn.vendor_id == vendor_id)
    if from_date: q = q.where(PurchaseReturn.return_date >= from_date)
    if to_date:   q = q.where(PurchaseReturn.return_date <= to_date)
    returns = (await db.execute(q)).scalars().all()
    for ret in returns:
        transactions.append({
            "date": ret.return_date,
            "type": "Purchase Return",
            "reference": ret.return_number,
            "debit": float(ret.total_amount),
            "credit": 0,
            "status": ret.status,
        })
 
    # ── Payments ──────────────────────────────────────────────────────────────
    q = select(PaymentVoucher).where(PaymentVoucher.vendor_id == vendor_id)
    if from_date: q = q.where(PaymentVoucher.payment_date >= from_date)
    if to_date:   q = q.where(PaymentVoucher.payment_date <= to_date)
    payments = (await db.execute(q)).scalars().all()
    for pay in payments:
        transactions.append({
            "date": pay.payment_date,
            "type": "Payment",
            "reference": pay.payment_number,
            "debit": float(pay.amount),
            "credit": 0,
            "status": "paid",
        })
 
    transactions.sort(key=lambda x: (0 if x["type"] == "Opening Balance" else 1, x["date"]))
 
    balance = 0.0
    for t in transactions:
        balance += t["credit"] - t["debit"]
        t["balance"] = round(balance, 2)
        t["date"] = str(t["date"])
 
    return {
        "vendor": {
            "id": vendor.id,
            "name": vendor.name,
            "code": vendor.code,
            "phone": vendor.phone,
        },
        "transactions": transactions,
        "summary": {
            "opening_balance": round(
                sum(t["credit"] - t["debit"] for t in transactions if t["type"] == "Opening Balance"), 2
            ),
            "total_purchases": round(sum(t["credit"] for t in transactions if t["type"] == "Purchase"), 2),
            "total_returns":   round(sum(t["debit"] for t in transactions if t["type"] == "Purchase Return"), 2),
            "total_paid":      round(sum(t["debit"] for t in transactions if t["type"] == "Payment"), 2),
            "closing_balance": round(balance, 2),
        }
    }
