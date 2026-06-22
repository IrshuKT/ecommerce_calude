"""
Reports: Ledger, Trial Balance, P&L, Balance Sheet, GST Returns
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import date

from app.db.session import get_db
from app.models.accounting import (
    Account, Journal, JournalLine, AccountType,
    SalesInvoice, Purchase, GSTReturn, GSTReturnType
)
from app.models.models import User
from app.api.v1.endpoints.auth import get_admin_user
from app.services.journal_service import get_account_balance

router = APIRouter()


# ── Ledger (account statement) ────────────

@router.get("/ledger/{account_code}")
async def get_ledger(
    account_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
):
    acc_result = await db.execute(select(Account).where(Account.code == account_code))
    account = acc_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    query = (
        select(JournalLine, Journal)
        .join(Journal)
        .where(JournalLine.account_id == account.id, Journal.is_posted == True)
        .order_by(Journal.voucher_date, Journal.id)
    )
    if from_date:
        query = query.where(Journal.voucher_date >= from_date)
    if to_date:
        query = query.where(Journal.voucher_date <= to_date)

    result = await db.execute(query)
    rows = result.all()

    entries = []
    running_balance = Decimal("0")
    for line, journal in rows:
        if account.account_type in (AccountType.asset, AccountType.expense):
            running_balance += line.debit - line.credit
        else:
            running_balance += line.credit - line.debit

        entries.append({
            "date": journal.voucher_date,
            "voucher_number": journal.voucher_number,
            "voucher_type": journal.voucher_type,
            "narration": line.narration or journal.narration,
            "debit": line.debit,
            "credit": line.credit,
            "balance": running_balance,
        })

    return {
        "account_code": account.code,
        "account_name": account.name,
        "account_type": account.account_type,
        "entries": entries,
        "closing_balance": running_balance,
    }


# ── Trial Balance ─────────────────────────

@router.get("/trial-balance")
async def trial_balance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    as_of_date: Optional[date] = None,
):
    acc_result = await db.execute(
        select(Account).where(Account.is_active == True).order_by(Account.code)
    )
    accounts = acc_result.scalars().all()

    rows = []
    total_debit = total_credit = Decimal("0")

    for account in accounts:
        query = (
            select(
                func.coalesce(func.sum(JournalLine.debit), 0).label("dr"),
                func.coalesce(func.sum(JournalLine.credit), 0).label("cr"),
            )
            .join(Journal)
            .where(JournalLine.account_id == account.id, Journal.is_posted == True)
        )
        if as_of_date:
            query = query.where(Journal.voucher_date <= as_of_date)

        r = await db.execute(query)
        row = r.one()
        dr = Decimal(str(row.dr))
        cr = Decimal(str(row.cr))

        if dr == 0 and cr == 0:
            continue

        rows.append({
            "code": account.code,
            "name": account.name,
            "type": account.account_type,
            "debit": dr,
            "credit": cr,
        })
        total_debit += dr
        total_credit += cr

    return {
        "as_of_date": as_of_date or date.today(),
        "accounts": rows,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "balanced": abs(total_debit - total_credit) < Decimal("0.01"),
    }


# ── P&L Statement ─────────────────────────

@router.get("/profit-loss")
async def profit_loss(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
):
    async def sum_type(acc_type: AccountType, from_d, to_d) -> Decimal:
        query = (
            select(func.coalesce(func.sum(JournalLine.credit - JournalLine.debit), 0))
            .join(Journal)
            .join(Account)
            .where(Account.account_type == acc_type, Journal.is_posted == True)
        )
        if from_d:
            query = query.where(Journal.voucher_date >= from_d)
        if to_d:
            query = query.where(Journal.voucher_date <= to_d)
        r = await db.execute(query)
        return Decimal(str(r.scalar()))

    total_income = await sum_type(AccountType.income, from_date, to_date)
    total_expense = -(await sum_type(AccountType.expense, from_date, to_date))

    # Get breakdown by account
    async def account_breakdown(acc_type: AccountType):
        query = (
            select(Account.code, Account.name,
                   func.coalesce(func.sum(JournalLine.credit - JournalLine.debit), 0).label("amount"))
            .join(JournalLine, Account.id == JournalLine.account_id)
            .join(Journal)
            .where(Account.account_type == acc_type, Journal.is_posted == True)
            .group_by(Account.code, Account.name)
            .order_by(Account.code)
        )
        if from_date:
            query = query.where(Journal.voucher_date >= from_date)
        if to_date:
            query = query.where(Journal.voucher_date <= to_date)
        r = await db.execute(query)
        return [{"code": row.code, "name": row.name, "amount": abs(Decimal(str(row.amount)))} for row in r.all()]

    income_items = await account_breakdown(AccountType.income)
    expense_items = await account_breakdown(AccountType.expense)
    net_profit = total_income - total_expense

    return {
        "period": {"from": from_date, "to": to_date or date.today()},
        "income": {"items": income_items, "total": total_income},
        "expenses": {"items": expense_items, "total": total_expense},
        "net_profit": net_profit,
        "is_profit": net_profit >= 0,
    }


# ── Balance Sheet ─────────────────────────

@router.get("/balance-sheet")
async def balance_sheet(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    as_of_date: Optional[date] = None,
):
    as_of = as_of_date or date.today()

    async def type_summary(acc_type: AccountType):
        query = (
            select(Account.code, Account.name,
                   func.coalesce(func.sum(JournalLine.debit), 0).label("dr"),
                   func.coalesce(func.sum(JournalLine.credit), 0).label("cr"))
            .join(JournalLine, Account.id == JournalLine.account_id)
            .join(Journal)
            .where(Account.account_type == acc_type, Journal.is_posted == True,
                   Journal.voucher_date <= as_of)
            .group_by(Account.code, Account.name)
            .order_by(Account.code)
        )
        r = await db.execute(query)
        items = []
        total = Decimal("0")
        for row in r.all():
            dr = Decimal(str(row.dr))
            cr = Decimal(str(row.cr))
            if acc_type in (AccountType.asset, AccountType.expense):
                bal = dr - cr
            else:
                bal = cr - dr
            if bal != 0:
                items.append({"code": row.code, "name": row.name, "balance": bal})
                total += bal
        return items, total

    assets, total_assets = await type_summary(AccountType.asset)
    liabilities, total_liabilities = await type_summary(AccountType.liability)
    equity, total_equity = await type_summary(AccountType.equity)

    # Add retained earnings from P&L
    pl = await profit_loss(db, None, None, as_of)
    retained = pl["net_profit"]

    return {
        "as_of_date": as_of,
        "assets": {"items": assets, "total": total_assets},
        "liabilities": {"items": liabilities, "total": total_liabilities},
        "equity": {
            "items": equity + [{"code": "RE", "name": "Retained Earnings", "balance": retained}],
            "total": total_equity + retained,
        },
        "balanced": abs(total_assets - (total_liabilities + total_equity + retained)) < Decimal("1"),
    }


# ── GST Returns ───────────────────────────

gst_router = APIRouter()


@gst_router.get("/gstr1")
async def generate_gstr1(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
):
    """Generate GSTR-1 data — outward supplies."""
    from_date = date(year, month, 1)
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    to_date = date(year, month, last_day)

    result = await db.execute(
        select(SalesInvoice)
        .where(
            SalesInvoice.invoice_date >= from_date,
            SalesInvoice.invoice_date <= to_date,
            SalesInvoice.status != "cancelled",
        )
        .order_by(SalesInvoice.invoice_date)
    )
    invoices = result.scalars().all()

    b2b = []   # invoices with GSTIN
    b2c = []   # invoices without GSTIN

    total_taxable = total_cgst = total_sgst = total_igst = Decimal("0")

    for inv in invoices:
        entry = {
            "invoice_number": inv.invoice_number,
            "invoice_date": inv.invoice_date,
            "customer_name": inv.billing_name,
            "taxable_value": inv.taxable_amount,
            "cgst": inv.cgst_amount,
            "sgst": inv.sgst_amount,
            "igst": inv.igst_amount,
            "total": inv.grand_total,
            "is_interstate": inv.is_interstate,
        }
        if inv.customer_gstin:
            entry["gstin"] = inv.customer_gstin
            b2b.append(entry)
        else:
            b2c.append(entry)

        total_taxable += inv.taxable_amount
        total_cgst += inv.cgst_amount
        total_sgst += inv.sgst_amount
        total_igst += inv.igst_amount

    return {
        "return_type": "GSTR-1",
        "period": f"{month:02d}/{year}",
        "b2b_invoices": b2b,
        "b2c_invoices": b2c,
        "summary": {
            "total_invoices": len(invoices),
            "total_taxable_value": total_taxable,
            "total_cgst": total_cgst,
            "total_sgst": total_sgst,
            "total_igst": total_igst,
            "total_tax": total_cgst + total_sgst + total_igst,
        },
    }


@gst_router.get("/gstr3b")
async def generate_gstr3b(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
):
    """Generate GSTR-3B summary."""
    from_date = date(year, month, 1)
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    to_date = date(year, month, last_day)

    # Outward supplies (from sales)
    sales_result = await db.execute(
        select(
            func.coalesce(func.sum(SalesInvoice.taxable_amount), 0).label("taxable"),
            func.coalesce(func.sum(SalesInvoice.cgst_amount), 0).label("cgst"),
            func.coalesce(func.sum(SalesInvoice.sgst_amount), 0).label("sgst"),
            func.coalesce(func.sum(SalesInvoice.igst_amount), 0).label("igst"),
        ).where(
            SalesInvoice.invoice_date >= from_date,
            SalesInvoice.invoice_date <= to_date,
            SalesInvoice.status != "cancelled",
        )
    )
    sales = sales_result.one()

    # ITC from purchases
    purchase_result = await db.execute(
        select(
            func.coalesce(func.sum(Purchase.cgst_amount), 0).label("cgst"),
            func.coalesce(func.sum(Purchase.sgst_amount), 0).label("sgst"),
            func.coalesce(func.sum(Purchase.igst_amount), 0).label("igst"),
        ).where(
            Purchase.purchase_date >= from_date,
            Purchase.purchase_date <= to_date,
            Purchase.status != "cancelled",
        )
    )
    itc = purchase_result.one()

    tax_liability = Decimal(str(sales.cgst)) + Decimal(str(sales.sgst)) + Decimal(str(sales.igst))
    itc_total = Decimal(str(itc.cgst)) + Decimal(str(itc.sgst)) + Decimal(str(itc.igst))
    net_payable = max(tax_liability - itc_total, Decimal("0"))

    return {
        "return_type": "GSTR-3B",
        "period": f"{month:02d}/{year}",
        "outward_supplies": {
            "taxable_value": Decimal(str(sales.taxable)),
            "cgst": Decimal(str(sales.cgst)),
            "sgst": Decimal(str(sales.sgst)),
            "igst": Decimal(str(sales.igst)),
            "total_tax": tax_liability,
        },
        "input_tax_credit": {
            "cgst": Decimal(str(itc.cgst)),
            "sgst": Decimal(str(itc.sgst)),
            "igst": Decimal(str(itc.igst)),
            "total_itc": itc_total,
        },
        "net_tax_payable": net_payable,
    }