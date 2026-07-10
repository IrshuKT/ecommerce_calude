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
from app.models.models import ProductVariant, Product, User, StockTransaction
from app.api.v1.endpoints.auth import get_admin_user


router = APIRouter()


class StockTxnIn(BaseModel):
    variant_id: int
    txn_type: str = "adjustment"
    qty_change: Optional[int] = None    # used for "in" / "out"
    new_qty: Optional[int] = None       # used for "adjustment"
    reference_type: Optional[str] = "manual"
    reference_id: Optional[str] = None
    note: Optional[str] = None


@router.get("/{product_id}/stock-transactions")
async def list_stock_transactions(
    product_id: int,
    variant_id: Optional[int] = None,
    txn_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """List all stock transactions for a product, optionally filtered by variant or type."""
    prod = await db.execute(
        select(Product).options(selectinload(Product.variants)).where(Product.id == product_id)
    )
    product = prod.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")

    variant_ids = [v.id for v in product.variants]
    if not variant_ids:
        return {"items": [], "total": 0, "page": page, "limit": limit}

    q = select(StockTransaction).where(StockTransaction.variant_id.in_(variant_ids))
    if variant_id:
        q = q.where(StockTransaction.variant_id == variant_id)
    if txn_type:
        q = q.where(StockTransaction.txn_type == txn_type)

    from sqlalchemy import func
    count_res = await db.execute(select(func.count()).select_from(q.subquery()))
    total = count_res.scalar()

    q = q.order_by(desc(StockTransaction.created_at)).offset((page - 1) * limit).limit(limit)
    result = await db.execute(q)
    txns = result.scalars().all()

    variant_map = {v.id: v for v in product.variants}

    return {
        "items": [
            {
                "id": t.id,
                "variant_id": t.variant_id,
                "variant_sku": variant_map[t.variant_id].sku if t.variant_id in variant_map else "—",
                "variant_attrs": variant_map[t.variant_id].selected_attributes if t.variant_id in variant_map else {},
                "txn_type": t.txn_type,
                "qty_change": t.qty_change,
                "qty_before": t.qty_before,
                "qty_after": t.qty_after,
                "reference_type": t.reference_type,
                "reference_id": t.reference_id,
                "note": t.note,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "created_by_id": t.created_by_id,
            }
            for t in txns
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }

@router.post("/{product_id}/stock-transactions", status_code=201)
async def create_stock_transaction(
    product_id: int,
    payload: StockTxnIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    if payload.txn_type not in ("in", "out", "adjustment"):
        raise HTTPException(400, "txn_type must be 'in', 'out', or 'adjustment'")

    # "in"/"out" use qty_change (a positive delta).
    # "adjustment" uses new_qty (the new absolute stock level) instead.
    if payload.txn_type in ("in", "out"):
        if payload.qty_change is None or payload.qty_change <= 0:
            raise HTTPException(400, "qty_change must be a positive number for 'in'/'out' transactions")
    else:
        if payload.new_qty is None or payload.new_qty < 0:
            raise HTTPException(400, "new_qty must be provided (and non-negative) for adjustment transactions")

    res = await db.execute(
        select(ProductVariant).where(
            ProductVariant.id == payload.variant_id,
            ProductVariant.product_id == product_id,
        )
    )
    variant = res.scalar_one_or_none()
    if not variant:
        raise HTTPException(404, "Variant not found for this product")

    qty_before = variant.stock_qty

    if payload.txn_type == "in":
        qty_after = qty_before + payload.qty_change
        qty_delta = payload.qty_change
    elif payload.txn_type == "out":
        qty_after = qty_before - payload.qty_change
        if qty_after < 0:
            raise HTTPException(400, f"Insufficient stock. Current: {qty_before}, requested: {payload.qty_change}")
        qty_delta = -payload.qty_change
    else:  # adjustment — new_qty is the new absolute qty
        qty_after = payload.new_qty
        qty_delta = qty_after - qty_before

    variant.stock_qty = qty_after

    txn = StockTransaction(
        variant_id=variant.id,
        txn_type=payload.txn_type,
        qty_change=qty_delta,
        qty_before=qty_before,
        qty_after=qty_after,
        reference_type=payload.reference_type,
        reference_id=payload.reference_id,
        note=payload.note,
        created_by_id=current_user.id,
    )
    db.add(txn)
    await db.commit()

    return {
        "id": txn.id,
        "qty_before": qty_before,
        "qty_after": qty_after,
        "message": "Stock transaction recorded",
    }