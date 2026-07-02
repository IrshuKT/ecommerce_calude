"""
Reports: Ledger, Trial Balance, P&L, Balance Sheet, GST Returns
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func,case, and_
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
from app.models.models import( Product,ProductVariant,Order,OrderItem,OrderStatus)


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

# ════════════════════════════════════════════════════════════════════════════
#  CASH BOOK
# ════════════════════════════════════════════════════════════════════════════
@router.get("/cash-book")
async def cash_book(
    from_date: date = Query(...),
    to_date:   date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    # find cash account (account_type=asset, code starts with your cash code)
    cash_result = await db.execute(
        select(Account).where(
            Account.account_type == AccountType.asset,
            Account.code.like("1010%"),   # ← adjust to your cash account code
            Account.is_active == True,
        ).limit(1)
    )
    cash_account = cash_result.scalar_one_or_none()
    if not cash_account:
        raise HTTPException(404, "Cash account not found. Adjust the code filter.")

    # opening balance = all posted lines before from_date
    ob = (await db.execute(
        select(
            func.coalesce(func.sum(JournalLine.debit),  0).label("dr"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("cr"),
        )
        .join(Journal, JournalLine.journal_id == Journal.id)
        .where(
            JournalLine.account_id == cash_account.id,
            Journal.is_posted == True,
            Journal.voucher_date < from_date,
        )
    )).one()
    opening_balance = Decimal(str(ob.dr)) - Decimal(str(ob.cr))

    lines = (await db.execute(
        select(JournalLine, Journal)
        .join(Journal, JournalLine.journal_id == Journal.id)
        .where(
            JournalLine.account_id == cash_account.id,
            Journal.is_posted == True,
            Journal.voucher_date >= from_date,
            Journal.voucher_date <= to_date,
        )
        .order_by(Journal.voucher_date, Journal.id)
    )).all()

    entries        = []
    running        = opening_balance
    total_receipts = Decimal("0")
    total_payments = Decimal("0")

    for line, journal in lines:
        dr = Decimal(str(line.debit  or 0))
        cr = Decimal(str(line.credit or 0))
        if dr > 0:
            running += dr;  total_receipts += dr
            tx_type, amount = "receipt", dr
        else:
            running -= cr;  total_payments += cr
            tx_type, amount = "payment", cr

        entries.append({
            "date":        journal.voucher_date,
            "particulars": line.narration or journal.narration or "",
            "voucher_no":  journal.voucher_number or str(journal.id),
            "type":        tx_type,
            "amount":      float(round(amount,  2)),
            "balance":     float(round(running, 2)),
        })

    return {
        "from_date":       from_date,
        "to_date":         to_date,
        "opening_balance": float(round(opening_balance, 2)),
        "total_receipts":  float(round(total_receipts,  2)),
        "total_payments":  float(round(total_payments,  2)),
        "closing_balance": float(round(running,         2)),
        "entries":         entries,
    }


# ════════════════════════════════════════════════════════════════════════════
#  DAY BOOK
# ════════════════════════════════════════════════════════════════════════════
@router.get("/day-book")
async def day_book(
    from_date: date = Query(...),
    to_date:   date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    rows = (await db.execute(
        select(JournalLine, Journal, Account)
        .join(Journal,  JournalLine.journal_id == Journal.id)
        .join(Account,  JournalLine.account_id == Account.id)
        .where(
            Journal.is_posted == True,
            Journal.voucher_date >= from_date,
            Journal.voucher_date <= to_date,
        )
        .order_by(Journal.voucher_date, Journal.id, JournalLine.id)
    )).all()

    entries      = []
    total_debit  = Decimal("0")
    total_credit = Decimal("0")

    for line, journal, account in rows:
        dr = Decimal(str(line.debit  or 0))
        cr = Decimal(str(line.credit or 0))
        total_debit  += dr
        total_credit += cr
        entries.append({
            "date":         journal.voucher_date,
            "voucher_no":   journal.voucher_number or str(journal.id),
            "voucher_type": getattr(journal, "voucher_type", "Journal"),
            "account_name": f"{account.code} — {account.name}",
            "narration":    line.narration or journal.narration or "",
            "debit":        float(dr),
            "credit":       float(cr),
        })

    return {
        "from_date":     from_date,
        "to_date":       to_date,
        "total_entries": len(entries),
        "total_debit":   float(round(total_debit,  2)),
        "total_credit":  float(round(total_credit, 2)),
        "entries":       entries,
    }


# ════════════════════════════════════════════════════════════════════════════
#  LEDGER
# ════════════════════════════════════════════════════════════════════════════
@router.get("/ledger")
async def ledger(
    account_code: str  = Query(..., description="Account code e.g. 1001"),
    from_date:    date = Query(...),
    to_date:      date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    account = (await db.execute(
        select(Account).where(Account.code == account_code)
    )).scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found.")

    ob = (await db.execute(
        select(
            func.coalesce(func.sum(JournalLine.debit),  0).label("dr"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("cr"),
        )
        .join(Journal, JournalLine.journal_id == Journal.id)
        .where(
            JournalLine.account_id == account.id,
            Journal.is_posted == True,
            Journal.voucher_date < from_date,
        )
    )).one()

    ob_dr = Decimal(str(ob.dr))
    ob_cr = Decimal(str(ob.cr))
    # debit-normal accounts: asset, expense  |  credit-normal: liability, equity, income
    if account.account_type in (AccountType.asset, AccountType.expense):
        opening_balance = ob_dr - ob_cr
    else:
        opening_balance = ob_cr - ob_dr

    lines = (await db.execute(
        select(JournalLine, Journal)
        .join(Journal, JournalLine.journal_id == Journal.id)
        .where(
            JournalLine.account_id == account.id,
            Journal.is_posted == True,
            Journal.voucher_date >= from_date,
            Journal.voucher_date <= to_date,
        )
        .order_by(Journal.voucher_date, Journal.id)
    )).all()

    entries      = []
    running      = opening_balance
    total_debit  = Decimal("0")
    total_credit = Decimal("0")

    for line, journal in lines:
        dr = Decimal(str(line.debit  or 0))
        cr = Decimal(str(line.credit or 0))
        total_debit  += dr
        total_credit += cr
        if account.account_type in (AccountType.asset, AccountType.expense):
            running += dr - cr
        else:
            running += cr - dr

        entries.append({
            "date":            journal.voucher_date,
            "particulars":     line.narration or journal.narration or "",
            "voucher_no":      journal.voucher_number or str(journal.id),
            "debit":           float(dr),
            "credit":          float(cr),
            "running_balance": float(round(running, 2)),
        })

    return {
        "account_code":    account.code,
        "account_name":    f"{account.code} — {account.name}",
        "from_date":       from_date,
        "to_date":         to_date,
        "opening_balance": float(round(opening_balance, 2)),
        "total_debit":     float(round(total_debit,     2)),
        "total_credit":    float(round(total_credit,    2)),
        "closing_balance": float(round(running,         2)),
        "entries":         entries,
    }


# ════════════════════════════════════════════════════════════════════════════
@router.get("/stock")
async def stock_report(
    from_date: date = Query(...),
    to_date:   date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    variants = (await db.execute(
        select(ProductVariant, Product)
        .join(Product, ProductVariant.product_id == Product.id)
        .where(
            ProductVariant.is_active == True,
            ProductVariant.track_inventory == True,
            Product.is_active == True,
        )
        .order_by(Product.name, ProductVariant.sku)
    )).all()

    items            = []
    total_sold_qty   = 0
    total_return_qty = 0
    low_stock_count  = 0

    for variant, product in variants:                          # ← loop header
        # All-time movements (to compute current stock)
        all_sold_result = await db.execute(                    # ← indented inside loop
            select(func.coalesce(func.sum(OrderItem.quantity), 0))
            .join(Order, OrderItem.order_id == Order.id)
            .where(
                OrderItem.variant_id == variant.id,
                Order.status.not_in([OrderStatus.cancelled, OrderStatus.refunded]),
            )
        )
        all_sold = int(all_sold_result.scalar() or 0)

        all_returned_result = await db.execute(
            select(func.coalesce(func.sum(OrderItem.quantity), 0))
            .join(Order, OrderItem.order_id == Order.id)
            .where(
                OrderItem.variant_id == variant.id,
                Order.status.in_([OrderStatus.cancelled, OrderStatus.refunded]),
            )
        )
        all_returned = int(all_returned_result.scalar() or 0)

        # In-range movements (for the report columns)
        sold_result = await db.execute(
            select(func.coalesce(func.sum(OrderItem.quantity), 0))
            .join(Order, OrderItem.order_id == Order.id)
            .where(
                OrderItem.variant_id == variant.id,
                Order.status.not_in([OrderStatus.cancelled, OrderStatus.refunded]),
                func.date(Order.created_at) >= from_date,
                func.date(Order.created_at) <= to_date,
            )
        )
        sold_qty = int(sold_result.scalar() or 0)

        returned_result = await db.execute(
            select(func.coalesce(func.sum(OrderItem.quantity), 0))
            .join(Order, OrderItem.order_id == Order.id)
            .where(
                OrderItem.variant_id == variant.id,
                Order.status.in_([OrderStatus.cancelled, OrderStatus.refunded]),
                func.date(Order.created_at) >= from_date,
                func.date(Order.created_at) <= to_date,
            )
        )
        returned_qty = int(returned_result.scalar() or 0)

        current_stock = variant.stock_qty - all_sold + all_returned
        threshold     = variant.low_stock_threshold or 5

        total_sold_qty   += sold_qty
        total_return_qty += returned_qty

        if current_stock <= threshold:
            low_stock_count += 1

        attrs = ", ".join(
            f"{k}: {v}" for k, v in (variant.selected_attributes or {}).items()
        )

        items.append({
    "id":           variant.id,
    "product":      product.name,        # was product_name
    "sku":          variant.sku,
    "attributes":   attrs,
    "inward":       returned_qty,        # was returned_qty
    "outward":      sold_qty,            # was sold_qty
    "closing":      current_stock,       # was current_stock
    "opening":      current_stock + sold_qty - returned_qty,  # back-derived
    "low_threshold": threshold,
    "is_low_stock": current_stock <= threshold,
})

    return {
        "from_date":        from_date,
        "to_date":          to_date,
        "total_variants":   len(items),
        "total_sold_qty":   total_sold_qty,
        "total_return_qty": total_return_qty,
        "low_stock_count":  low_stock_count,
        "items":            items,
    }
# ════════════════════════════════════════════════════════════════════════════
#  STOCK VALUATION
#  stock_qty * cost_price per variant, as of today (stock_qty is live)
# ════════════════════════════════════════════════════════════════════════════
@router.get("/stock-value")
async def stock_value(
    as_of_date: date = Query(...),   # kept for API consistency; stock_qty is current
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    variants = (await db.execute(
        select(ProductVariant, Product)
        .join(Product, ProductVariant.product_id == Product.id)
        .where(
            ProductVariant.is_active == True,
            ProductVariant.track_inventory == True,
            ProductVariant.stock_qty > 0,
            Product.is_active == True,
        )
        .order_by(Product.name, ProductVariant.sku)
    )).all()

    items       = []
    total_qty   = 0
    total_value = Decimal("0")

    for variant, product in variants:
        qty        = variant.stock_qty
        cost_price = Decimal(str(variant.cost_price or 0))
        value      = Decimal(qty) * cost_price
        total_qty   += qty
        total_value += value

        attrs = ", ".join(
            f"{k}: {v}" for k, v in (variant.selected_attributes or {}).items()
        )

        items.append({
            "id":           variant.id,
            "product_name": product.name,
            "sku":          variant.sku,
            "attributes":   attrs,
            "qty":          qty,
            "cost_price":   float(cost_price),
            "retail_price": float(variant.retail_price or 0),
            "value":        float(round(value, 2)),
        })

    return {
        "as_of_date":  as_of_date,
        "total_qty":   total_qty,
        "total_value": float(round(total_value, 2)),
        "items":       items,
    }