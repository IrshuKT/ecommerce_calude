"""
Stock Transactions API
Mount at: /products  (alongside existing products router)
Full prefix becomes: /api/v1/products/{product_id}/stock-transactions
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
import enum

from app.db.session import get_db
from app.models.models import ProductVariant, Product, User
from app.api.v1.endpoints.auth import get_admin_user

import enum
from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    String, Text, Boolean, Integer, Numeric, DateTime, Enum,
    ForeignKey, JSON, UniqueConstraint, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


# ── ORM model (add this to app/models/models.py too) ──────────────────────────
# Paste this class into models.py and run the migration before using this router.

import enum as _enum
class StockTxnType(str, _enum.Enum):
     in_ = "in"
     out = "out"
     adjustment = "adjustment"

class StockTransaction(Base):
    __tablename__ = "stock_transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id", ondelete="CASCADE"), index=True)
    txn_type: Mapped[StockTxnType] = mapped_column(Enum(StockTxnType, values_callable=lambda x: [e.value for e in x]))
    qty_change: Mapped[int] = mapped_column(Integer)
    qty_before: Mapped[int] = mapped_column(Integer)
    qty_after: Mapped[int] = mapped_column(Integer)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50))
    reference_id: Mapped[Optional[str]] = mapped_column(String(100))
    note: Mapped[Optional[str]] = mapped_column(String(500))
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    variant: Mapped["ProductVariant"] = relationship("ProductVariant")
    created_by: Mapped[Optional["User"]] = relationship("User")
# ────────────────────────────────────────────────────────────────────────────────



