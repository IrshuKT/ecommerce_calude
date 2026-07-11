import enum
from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    String, Integer, Numeric, DateTime, Enum, ForeignKey, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models.models import ProductVariant,InternalUser,User

class POSSaleStatus(str, enum.Enum):
    held = "held"
    completed = "completed"
    voided = "voided"


class POSPaymentMethod(str, enum.Enum):
    cash = "cash"
    card = "card"
    upi = "upi"


class POSSale(Base):
    __tablename__ = "pos_sales"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sale_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[POSSaleStatus] = mapped_column(
        Enum(POSSaleStatus, values_callable=lambda x: [e.value for e in x]),
        default=POSSaleStatus.completed,
    )
    cashier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("internal_users.id", ondelete="SET NULL"))
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    walk_in_name: Mapped[Optional[str]] = mapped_column(String(100))
    journal_id: Mapped[Optional[int]] = mapped_column(ForeignKey("journals.id"))
    notes: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    items: Mapped[List["POSSaleItem"]] = relationship(
        "POSSaleItem", back_populates="sale", cascade="all, delete-orphan"
    )
    payments: Mapped[List["POSPayment"]] = relationship(
        "POSPayment", back_populates="sale", cascade="all, delete-orphan"
    )
    cashier: Mapped[Optional["InternalUser"]] = relationship("InternalUser")
    customer: Mapped[Optional["User"]] = relationship("User")


class POSSaleItem(Base):
    __tablename__ = "pos_sale_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pos_sale_id: Mapped[int] = mapped_column(ForeignKey("pos_sales.id", ondelete="CASCADE"))
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id"))
    product_name: Mapped[str] = mapped_column(String(200))
    variant_sku: Mapped[str] = mapped_column(String(100))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    sale: Mapped["POSSale"] = relationship("POSSale", back_populates="items")
    variant: Mapped["ProductVariant"] = relationship("ProductVariant")


class POSPayment(Base):
    __tablename__ = "pos_payments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pos_sale_id: Mapped[int] = mapped_column(ForeignKey("pos_sales.id", ondelete="CASCADE"))
    method: Mapped[POSPaymentMethod] = mapped_column(
        Enum(POSPaymentMethod, values_callable=lambda x: [e.value for e in x])
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    sale: Mapped["POSSale"] = relationship("POSSale", back_populates="payments")
