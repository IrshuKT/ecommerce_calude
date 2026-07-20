from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import random, string
from app.models.accounting import Journal, JournalLine, Account, VoucherType, NumberSequence


def _current_financial_year(d: date = None) -> str:
    d = d or date.today()
    # Indian FY: Apr 1 – Mar 31
    if d.month >= 4:
        start, end = d.year, d.year + 1
    else:
        start, end = d.year - 1, d.year
    return f"{start}-{str(end)[-2:]}"


async def get_next_number(db: AsyncSession, doc_type: str, prefix: str, pad: int = 4) -> str:
    """Atomically returns the next sequential number for a document type,
    scoped to the current Indian financial year (Apr–Mar)."""
    fy = _current_financial_year()

    result = await db.execute(
        select(NumberSequence)
        .where(NumberSequence.doc_type == doc_type, NumberSequence.financial_year == fy)
        .with_for_update()
    )
    seq = result.scalar_one_or_none()

    if seq is None:
        seq = NumberSequence(doc_type=doc_type, financial_year=fy, last_number=0)
        db.add(seq)
        await db.flush()
        result = await db.execute(
            select(NumberSequence)
            .where(NumberSequence.doc_type == doc_type, NumberSequence.financial_year == fy)
            .with_for_update()
        )
        seq = result.scalar_one()

    seq.last_number += 1
    await db.flush()
    return f"{prefix}/{fy}/{str(seq.last_number).zfill(pad)}"


async def inv_number(db):   return await get_next_number(db, "INV", "INV")
async def ret_number(db):   return await get_next_number(db, "RET", "RET")
async def purch_number(db): return await get_next_number(db, "PUR", "PUR")
async def rcpt_number(db):  return await get_next_number(db, "RCP", "RCP")
async def pay_number(db):   return await get_next_number(db, "PAY", "PAY")
async def jnl_number(db):   return await get_next_number(db, "JNL", "JNL")
async def cn_number(db):    return await get_next_number(db, "CN", "CN")
async def dn_number(db):    return await get_next_number(db, "DN", "DN")
async def pr_number(db):    return await get_next_number(db, "PRR", "PRR")
async def vnd_number(db): return await get_next_number(db, "VND", "VND")


async def get_account(db: AsyncSession, code: str) -> Account:
    result = await db.execute(select(Account).where(Account.code == code))
    account = result.scalar_one_or_none()
    if not account:
        raise ValueError(f"Account not found: {code}")
    return account


async def post_journal(db, voucher_type, voucher_date, lines, reference=None, narration=None, created_by_id=None):
    total_debit = sum(Decimal(str(l.get("debit", 0))) for l in lines)
    total_credit = sum(Decimal(str(l.get("credit", 0))) for l in lines)
    if abs(total_debit - total_credit) > Decimal("0.01"):
        raise ValueError(f"Journal imbalance: debit={total_debit} credit={total_credit}")
    journal = Journal(voucher_number=await jnl_number(db), voucher_type=voucher_type,
                      voucher_date=voucher_date, reference=reference, narration=narration,
                      is_posted=True, created_by_id=created_by_id)
    db.add(journal)
    await db.flush()
    for line in lines:
        account = await get_account(db, line["account_code"])
        db.add(JournalLine(journal_id=journal.id, 
                           account_id=account.id,
                           debit=Decimal(str(line.get("debit", 0))),
                           credit=Decimal(str(line.get("credit", 0))),
                           narration=line.get("narration"),
                           vendor_id=line.get("vendor_id"),
                           customer_id=line.get("customer_id")))
    return journal

async def post_pos_sale_journal(db, sale, payments, cgst_amount=None, sgst_amount=None, created_by_user_id=None):
    """Debits each payment method's account (cash/card/upi), credits
    Sales for the taxable portion and Output CGST/SGST for the tax portion.
    POS sales are immediate cash transactions with no receivable involved,
    unlike post_sales_invoice_journal which debits Accounts Receivable (1200)."""
    cgst_amount = cgst_amount or Decimal("0")
    sgst_amount = sgst_amount or Decimal("0")
    taxable_amount = sale.total_amount - cgst_amount - sgst_amount

    lines = []
    for p in payments:
        account = await get_account(db, _payment_mode_account(p["method"]))
        lines.append({
            "account_code": account.code,
            "debit": float(p["amount"]),
            "narration": f"POS sale {sale.sale_number} ({p['method']})",
        })
    lines.append({
        "account_code": "4000",
        "credit": float(taxable_amount),
        "narration": f"POS sale {sale.sale_number}",
    })
    if cgst_amount:
        lines.append({"account_code": "2100", "credit": float(cgst_amount), "narration": "CGST on POS sale"})
    if sgst_amount:
        lines.append({"account_code": "2200", "credit": float(sgst_amount), "narration": "SGST on POS sale"})

    return await post_journal(
        db, VoucherType.pos_sale, sale.created_at.date(), lines,
        reference=sale.sale_number, narration=f"POS sale {sale.sale_number}",
        created_by_id=created_by_user_id,
    )

def _payment_mode_account(mode: str) -> str:
    return {"cash": "1010", "cod": "1010", "upi": "1020",
            "bank_transfer": "1020", "razorpay": "1020",
            "cheque": "1020", "neft": "1020", "rtgs": "1020"}.get(mode.lower(), "1020")


async def post_sales_invoice_journal(db, invoice, customer_id):
    lines = [
        {"account_code": "1200", "debit": float(invoice.grand_total), "narration": f"Invoice {invoice.invoice_number}", "customer_id": customer_id},
        {"account_code": "4000", "credit": float(invoice.taxable_amount), "narration": f"Sales {invoice.invoice_number}"},
    ]
    if invoice.is_interstate:
        lines.append({"account_code": "2300", "credit": float(invoice.igst_amount), "narration": "IGST on sales"})
    else:
        if invoice.cgst_amount: lines.append({"account_code": "2100", "credit": float(invoice.cgst_amount), "narration": "CGST on sales"})
        if invoice.sgst_amount: lines.append({"account_code": "2200", "credit": float(invoice.sgst_amount), "narration": "SGST on sales"})
    if invoice.shipping_charge:
        lines.append({"account_code": "4100", "credit": float(invoice.shipping_charge), "narration": "Shipping"})

    round_off = float(invoice.round_off or 0)
    if abs(round_off) >= 0.005:
        if round_off > 0:
            lines.append({"account_code": "4900", "credit": round_off, "narration": "Round off"})
        else:
            lines.append({"account_code": "4900", "debit": abs(round_off), "narration": "Round off"})

    return await post_journal(db, VoucherType.sales_invoice, invoice.invoice_date, lines, reference=invoice.invoice_number, narration=f"Sales invoice {invoice.invoice_number}")

async def post_receipt_journal(db, receipt, customer_id):
    debit_account = await get_account(db, _payment_mode_account(receipt.payment_mode))
    lines = [
        {"account_code": debit_account.code, "debit": float(receipt.amount), "narration": f"Receipt {receipt.receipt_number}", "customer_id": customer_id},
        {"account_code": "1200", "credit": float(receipt.amount), "narration": "Against invoice", "customer_id": customer_id},
    ]
    return await post_journal(db, VoucherType.receipt, receipt.receipt_date, lines, reference=receipt.receipt_number)


async def post_purchase_journal(db, purchase, vendor_id):
    lines = [
        {"account_code": "5000", "debit": float(purchase.taxable_amount), "narration": f"Purchase {purchase.purchase_number}", "vendor_id": vendor_id},
        {"account_code": "2000", "credit": float(purchase.grand_total), "narration": f"Payable {purchase.purchase_number}", "vendor_id": vendor_id},
    ]
    if purchase.is_interstate:
        lines.append({"account_code": "1300", "debit": float(purchase.igst_amount), "narration": "IGST ITC"})
    else:
        if purchase.cgst_amount: lines.append({"account_code": "1310", "debit": float(purchase.cgst_amount), "narration": "CGST ITC"})
        if purchase.sgst_amount: lines.append({"account_code": "1320", "debit": float(purchase.sgst_amount), "narration": "SGST ITC"})
    return await post_journal(db, VoucherType.purchase_invoice, purchase.purchase_date, lines, reference=purchase.purchase_number)


async def post_payment_journal(db, payment, vendor_id):
    credit_account = await get_account(db, _payment_mode_account(payment.payment_mode))
    lines = [
        {"account_code": "2000", "debit": float(payment.amount), "narration": f"Payment {payment.payment_number}", "vendor_id": vendor_id},
        {"account_code": credit_account.code, "credit": float(payment.amount), "narration": f"{payment.payment_mode}", "vendor_id": vendor_id},
    ]
    return await post_journal(db, VoucherType.payment, payment.payment_date, lines, reference=payment.payment_number)


async def post_sales_return_journal(db, sales_return, customer_id):
    lines = [
        {"account_code": "4000", "debit": float(sales_return.subtotal), "narration": f"Sales return {sales_return.return_number}", "customer_id": customer_id},
        {"account_code": "1200", "credit": float(sales_return.total_amount), "narration": f"Credit note {sales_return.credit_note_number}", "customer_id": customer_id},
    ]
    if sales_return.igst_amount: lines.append({"account_code": "2300", "debit": float(sales_return.igst_amount), "narration": "IGST reversal"})
    else:
        if sales_return.cgst_amount: lines.append({"account_code": "2100", "debit": float(sales_return.cgst_amount), "narration": "CGST reversal"})
        if sales_return.sgst_amount: lines.append({"account_code": "2200", "debit": float(sales_return.sgst_amount), "narration": "SGST reversal"})
    return await post_journal(db, VoucherType.sales_return, sales_return.return_date, lines, reference=sales_return.return_number)


async def post_purchase_return_journal(db, purchase_return, vendor_id):
    lines = [
        {"account_code": "2000", "debit": float(purchase_return.total_amount), "narration": f"Debit note {purchase_return.debit_note_number}", "vendor_id": vendor_id},
        {"account_code": "5000", "credit": float(purchase_return.subtotal), "narration": f"Purchase return {purchase_return.return_number}", "vendor_id": vendor_id},
    ]
    if purchase_return.igst_amount: lines.append({"account_code": "1300", "credit": float(purchase_return.igst_amount), "narration": "IGST ITC reversal"})
    else:
        if purchase_return.cgst_amount: lines.append({"account_code": "1310", "credit": float(purchase_return.cgst_amount), "narration": "CGST ITC reversal"})
        if purchase_return.sgst_amount: lines.append({"account_code": "1320", "credit": float(purchase_return.sgst_amount), "narration": "SGST ITC reversal"})
    return await post_journal(db, VoucherType.purchase_return, purchase_return.return_date, lines, reference=purchase_return.return_number)


async def get_account_balance(db, account_code, as_of_date=None):
    account = await get_account(db, account_code)
    query = (select(func.coalesce(func.sum(JournalLine.debit), 0).label("dr"),
                    func.coalesce(func.sum(JournalLine.credit), 0).label("cr"))
             .join(Journal).where(JournalLine.account_id == account.id, Journal.is_posted == True))
    if as_of_date: query = query.where(Journal.voucher_date <= as_of_date)
    r = await db.execute(query)
    row = r.one()
    dr, cr = Decimal(str(row.dr)), Decimal(str(row.cr))
    balance = (dr - cr) if account.account_type in ("asset", "expense") else (cr - dr)
    return {"account_code": account_code, "account_name": account.name, "account_type": account.account_type, "total_debit": dr, "total_credit": cr, "balance": balance}
