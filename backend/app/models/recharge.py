import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Integer, Numeric, Date, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class RechargeOperator(str, enum.Enum):
    jio = "jio"
    airtel = "airtel"
    vi = "vi"
    bsnl = "bsnl"


class RechargeEntry(Base):
    """A single customer recharge — deducts from that operator's wallet."""
    __tablename__ = "recharge_entries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    operator: Mapped[RechargeOperator] = mapped_column(Enum(RechargeOperator))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    entry_date: Mapped[date] = mapped_column(Date, default=date.today)
    notes: Mapped[Optional[str]] = mapped_column(String(200))
    cashier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("internal_users.id"))
    journal_id: Mapped[Optional[int]] = mapped_column(ForeignKey("journals.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())


class RechargeWalletTopup(Base):
    """Buying bulk balance from the distributor — tops up the wallet."""
    __tablename__ = "recharge_wallet_topups"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    operator: Mapped[RechargeOperator] = mapped_column(Enum(RechargeOperator))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    topup_date: Mapped[date] = mapped_column(Date, default=date.today)
    payment_mode: Mapped[str] = mapped_column(String(30))
    notes: Mapped[Optional[str]] = mapped_column(String(200))
    journal_id: Mapped[Optional[int]] = mapped_column(ForeignKey("journals.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())


class RechargeCommission(Base):
    """Monthly (or whenever-paid) commission received — the actual income."""
    __tablename__ = "recharge_commissions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    operator: Mapped[RechargeOperator] = mapped_column(Enum(RechargeOperator))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    period_month: Mapped[int] = mapped_column(Integer)
    period_year: Mapped[int] = mapped_column(Integer)
    received_date: Mapped[date] = mapped_column(Date, default=date.today)
    payment_mode: Mapped[str] = mapped_column(String(30))
    notes: Mapped[Optional[str]] = mapped_column(String(200))
    journal_id: Mapped[Optional[int]] = mapped_column(ForeignKey("journals.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())