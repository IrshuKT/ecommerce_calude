import enum
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    String, Text, Boolean, Integer, Numeric, DateTime, Date, Enum,
    ForeignKey, JSON, UniqueConstraint, func, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class AccountType(str, enum.Enum):
    asset = "asset"
    liability = "liability"
    equity = "equity"
    income = "income"
    expense = "expense"


class VoucherType(str, enum.Enum):
    sales_invoice = "sales_invoice"
    sales_return = "sales_return"
    purchase_invoice = "purchase_invoice"
    purchase_return = "purchase_return"
    receipt = "receipt"
    payment = "payment"
    journal = "journal"
    credit_note = "credit_note"
    debit_note = "debit_note"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    confirmed = "confirmed"
    partially_paid = "partially_paid"
    paid = "paid"
    cancelled = "cancelled"


class ReturnStatus(str, enum.Enum):
    requested = "requested"
    approved = "approved"
    rejected = "rejected"
    completed = "completed"


class PurchaseStatus(str, enum.Enum):
    draft = "draft"
    ordered = "ordered"
    received = "received"
    partially_received = "partially_received"
    cancelled = "cancelled"
    invoiced = "invoiced"


class VendorStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


class GSTReturnType(str, enum.Enum):
    gstr1 = "gstr1"
    gstr3b = "gstr3b"


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    account_type: Mapped[AccountType] = mapped_column(Enum(AccountType))
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("accounts.id"))
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    parent: Mapped[Optional["Account"]] = relationship("Account", remote_side="Account.id")
    journal_lines: Mapped[List["JournalLine"]] = relationship("JournalLine", back_populates="account")
    __table_args__ = (Index("ix_accounts_type", "account_type"),)


class Vendor(Base):
    __tablename__ = "vendors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(20))
    pan: Mapped[Optional[str]] = mapped_column(String(12))
    phone: Mapped[Optional[str]] = mapped_column(String(15))
    email: Mapped[Optional[str]] = mapped_column(String(150))
    contact_person: Mapped[Optional[str]] = mapped_column(String(100))
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    address_line2: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(100), default="Kerala")
    state_code: Mapped[str] = mapped_column(String(5), default="32")
    pincode: Mapped[Optional[str]] = mapped_column(String(10))
    credit_days: Mapped[int] = mapped_column(Integer, default=30)
    credit_limit: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    account_id: Mapped[Optional[int]] = mapped_column(ForeignKey("accounts.id"))
    status: Mapped[VendorStatus] = mapped_column(Enum(VendorStatus), default=VendorStatus.active)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    account: Mapped[Optional["Account"]] = relationship("Account")
    purchases: Mapped[List["Purchase"]] = relationship("Purchase", back_populates="vendor")
    purchase_returns: Mapped[List["PurchaseReturn"]] = relationship("PurchaseReturn", back_populates="vendor")


class Journal(Base):
    __tablename__ = "journals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    voucher_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    voucher_type: Mapped[VoucherType] = mapped_column(Enum(VoucherType))
    voucher_date: Mapped[date] = mapped_column(Date)
    reference: Mapped[Optional[str]] = mapped_column(String(100))
    narration: Mapped[Optional[str]] = mapped_column(String(500))
    is_posted: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    lines: Mapped[List["JournalLine"]] = relationship("JournalLine", back_populates="journal", cascade="all, delete-orphan")
    __table_args__ = (Index("ix_journals_date", "voucher_date"),)


class JournalLine(Base):
    __tablename__ = "journal_lines"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    journal_id: Mapped[int] = mapped_column(ForeignKey("journals.id", ondelete="CASCADE"))
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    debit: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    credit: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    narration: Mapped[Optional[str]] = mapped_column(String(300))
    vendor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("vendors.id"))
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    journal: Mapped["Journal"] = relationship("Journal", back_populates="lines")
    account: Mapped["Account"] = relationship("Account", back_populates="journal_lines")


class SalesInvoice(Base):
    __tablename__ = "sales_invoices"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    invoice_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    order_id: Mapped[Optional[int]] = mapped_column(ForeignKey("orders.id"))
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    billing_name: Mapped[str] = mapped_column(String(100))
    billing_phone: Mapped[str] = mapped_column(String(15))
    billing_line1: Mapped[str] = mapped_column(String(255))
    billing_line2: Mapped[Optional[str]] = mapped_column(String(255))
    billing_city: Mapped[str] = mapped_column(String(100))
    billing_state: Mapped[str] = mapped_column(String(100))
    billing_state_code: Mapped[str] = mapped_column(String(5))
    billing_pincode: Mapped[str] = mapped_column(String(10))
    customer_gstin: Mapped[Optional[str]] = mapped_column(String(20))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    igst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_tax: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    shipping_charge: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    round_off: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    balance_due: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    is_interstate: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.draft)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    journal_id: Mapped[Optional[int]] = mapped_column(ForeignKey("journals.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    items: Mapped[List["SalesInvoiceItem"]] = relationship("SalesInvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    returns: Mapped[List["SalesReturn"]] = relationship("SalesReturn", back_populates="invoice")
    receipts: Mapped[List["ReceiptVoucher"]] = relationship("ReceiptVoucher", back_populates="invoice")


class SalesInvoiceItem(Base):
    __tablename__ = "sales_invoice_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("sales_invoices.id", ondelete="CASCADE"))
    product_name: Mapped[str] = mapped_column(String(200))
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20))
    description: Mapped[Optional[str]] = mapped_column(String(300))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    unit: Mapped[str] = mapped_column(String(20), default="Nos")
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    cgst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    sgst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    igst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    igst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    invoice: Mapped["SalesInvoice"] = relationship("SalesInvoice", back_populates="items")


class SalesReturn(Base):
    __tablename__ = "sales_returns"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    return_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    return_date: Mapped[date] = mapped_column(Date)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("sales_invoices.id"))
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[Optional[str]] = mapped_column(String(500))
    status: Mapped[ReturnStatus] = mapped_column(Enum(ReturnStatus), default=ReturnStatus.requested)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    igst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    credit_note_number: Mapped[Optional[str]] = mapped_column(String(50))
    journal_id: Mapped[Optional[int]] = mapped_column(ForeignKey("journals.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    invoice: Mapped["SalesInvoice"] = relationship("SalesInvoice", back_populates="returns")
    items: Mapped[List["SalesReturnItem"]] = relationship("SalesReturnItem", back_populates="sales_return", cascade="all, delete-orphan")


class SalesReturnItem(Base):
    __tablename__ = "sales_return_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    return_id: Mapped[int] = mapped_column(ForeignKey("sales_returns.id", ondelete="CASCADE"))
    product_name: Mapped[str] = mapped_column(String(200))
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    igst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    restock: Mapped[bool] = mapped_column(Boolean, default=True)
    sales_return: Mapped["SalesReturn"] = relationship("SalesReturn", back_populates="items")


class Purchase(Base):
    __tablename__ = "purchases"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    purchase_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"))
    purchase_date: Mapped[date] = mapped_column(Date)
    vendor_invoice_number: Mapped[Optional[str]] = mapped_column(String(100))
    vendor_invoice_date: Mapped[Optional[date]] = mapped_column(Date)
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    igst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_tax: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    balance_due: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    is_interstate: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[PurchaseStatus] = mapped_column(Enum(PurchaseStatus), default=PurchaseStatus.draft)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    journal_id: Mapped[Optional[int]] = mapped_column(ForeignKey("journals.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="purchases")
    items: Mapped[List["PurchaseItem"]] = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")
    returns: Mapped[List["PurchaseReturn"]] = relationship("PurchaseReturn", back_populates="purchase")
    payments: Mapped[List["PaymentVoucher"]] = relationship("PaymentVoucher", back_populates="purchase")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    purchase_id: Mapped[int] = mapped_column(ForeignKey("purchases.id", ondelete="CASCADE"))
    variant_id: Mapped[Optional[int]] = mapped_column(ForeignKey("product_variants.id"))
    product_name: Mapped[str] = mapped_column(String(200))
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    unit: Mapped[str] = mapped_column(String(20), default="Nos")
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=18)
    cgst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    sgst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    igst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    igst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    received_qty: Mapped[Decimal] = mapped_column(Numeric(10, 3), default=0)
    purchase: Mapped["Purchase"] = relationship("Purchase", back_populates="items")


class PurchaseReturn(Base):
    __tablename__ = "purchase_returns"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    return_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    return_date: Mapped[date] = mapped_column(Date)
    purchase_id: Mapped[int] = mapped_column(ForeignKey("purchases.id"))
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"))
    reason: Mapped[Optional[str]] = mapped_column(String(500))
    status: Mapped[ReturnStatus] = mapped_column(Enum(ReturnStatus), default=ReturnStatus.requested)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    igst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    debit_note_number: Mapped[Optional[str]] = mapped_column(String(50))
    journal_id: Mapped[Optional[int]] = mapped_column(ForeignKey("journals.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="purchase_returns")
    purchase: Mapped["Purchase"] = relationship("Purchase", back_populates="returns")
    items: Mapped[List["PurchaseReturnItem"]] = relationship("PurchaseReturnItem", back_populates="purchase_return", cascade="all, delete-orphan")


class PurchaseReturnItem(Base):
    __tablename__ = "purchase_return_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    return_id: Mapped[int] = mapped_column(ForeignKey("purchase_returns.id", ondelete="CASCADE"))
    product_name: Mapped[str] = mapped_column(String(200))
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    igst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    purchase_return: Mapped["PurchaseReturn"] = relationship("PurchaseReturn", back_populates="items")


class ReceiptVoucher(Base):
    __tablename__ = "receipt_vouchers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    receipt_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    receipt_date: Mapped[date] = mapped_column(Date)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    invoice_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sales_invoices.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    payment_mode: Mapped[str] = mapped_column(String(30))
    reference_number: Mapped[Optional[str]] = mapped_column(String(100))
    bank_account: Mapped[Optional[str]] = mapped_column(String(100))
    narration: Mapped[Optional[str]] = mapped_column(String(300))
    debit_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    journal_id: Mapped[Optional[int]] = mapped_column(ForeignKey("journals.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    invoice: Mapped[Optional["SalesInvoice"]] = relationship("SalesInvoice", back_populates="receipts")
    debit_account: Mapped["Account"] = relationship("Account", foreign_keys=[debit_account_id])


class PaymentVoucher(Base):
    __tablename__ = "payment_vouchers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    payment_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    payment_date: Mapped[date] = mapped_column(Date)
    vendor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("vendors.id"))
    purchase_id: Mapped[Optional[int]] = mapped_column(ForeignKey("purchases.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    payment_mode: Mapped[str] = mapped_column(String(30))
    reference_number: Mapped[Optional[str]] = mapped_column(String(100))
    bank_account: Mapped[Optional[str]] = mapped_column(String(100))
    narration: Mapped[Optional[str]] = mapped_column(String(300))
    credit_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    journal_id: Mapped[Optional[int]] = mapped_column(ForeignKey("journals.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    vendor: Mapped[Optional["Vendor"]] = relationship("Vendor")
    purchase: Mapped[Optional["Purchase"]] = relationship("Purchase", back_populates="payments")
    credit_account: Mapped["Account"] = relationship("Account", foreign_keys=[credit_account_id])


class GSTReturn(Base):
    __tablename__ = "gst_returns"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    return_type: Mapped[GSTReturnType] = mapped_column(Enum(GSTReturnType))
    period_month: Mapped[int] = mapped_column(Integer)
    period_year: Mapped[int] = mapped_column(Integer)
    filing_date: Mapped[Optional[date]] = mapped_column(Date)
    is_filed: Mapped[bool] = mapped_column(Boolean, default=False)
    total_taxable_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    total_cgst: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    total_sgst: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    total_igst: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    total_tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    itc_cgst: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    itc_sgst: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    itc_igst: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    net_tax_payable: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    data_snapshot: Mapped[Optional[dict]] = mapped_column(JSON)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    __table_args__ = (UniqueConstraint("return_type", "period_month", "period_year", name="uq_gst_return_period"),)
