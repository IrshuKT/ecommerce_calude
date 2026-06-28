from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import random, string
from app.models.accounting import Journal, JournalLine, Account, VoucherType


def _s(n=4): return ''.join(random.choices(string.digits, k=n))
def inv_number():   return f"INV-{datetime.now().strftime('%y%m')}-{_s()}"
def ret_number():   return f"RET-{datetime.now().strftime('%y%m')}-{_s()}"
def purch_number(): return f"PUR-{datetime.now().strftime('%y%m')}-{_s()}"
def rcpt_number():  return f"RCP-{datetime.now().strftime('%y%m')}-{_s()}"
def pay_number():   return f"PAY-{datetime.now().strftime('%y%m')}-{_s()}"
def jnl_number():   return f"JNL-{datetime.now().strftime('%y%m')}-{_s()}"
def cn_number():    return f"CN-{datetime.now().strftime('%y%m')}-{_s()}"
def dn_number():    return f"DN-{datetime.now().strftime('%y%m')}-{_s()}"
def pr_number():    return f"PRR-{datetime.now().strftime('%y%m')}-{_s()}"


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
    journal = Journal(voucher_number=jnl_number(), voucher_type=voucher_type,
                      voucher_date=voucher_date, reference=reference, narration=narration,
                      is_posted=True, created_by_id=created_by_id)
    db.add(journal)
    await db.flush()
    for line in lines:
        account = await get_account(db, line["account_code"])
        db.add(JournalLine(journal_id=journal.id, account_id=account.id,
                           debit=Decimal(str(line.get("debit", 0))),
                           credit=Decimal(str(line.get("credit", 0))),
                           narration=line.get("narration"),
                           vendor_id=line.get("vendor_id"),
                           customer_id=line.get("customer_id")))
    return journal


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
