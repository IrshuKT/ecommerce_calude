from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import ProductVariant
from app.models.models import StockTransaction


async def record_stock_transaction(
    db: AsyncSession,
    *,
    variant: ProductVariant,
    txn_type: str,
    qty: int,
    reference_type: str | None = None,
    reference_id: str | None = None,
    note: str | None = None,
    created_by_id: int | None = None,
):
    """
    qty:
        Stock In  -> positive quantity
        Stock Out -> positive quantity
        Adjustment -> absolute stock quantity
    """

    before = variant.stock_qty

    if txn_type == "in":
        after = before + qty
        qty_change = qty

    elif txn_type == "out":
        after = before - qty
        if after < 0:
            raise ValueError("Insufficient stock")
        qty_change = -qty

    elif txn_type == "adjustment":
        after = qty
        qty_change = after - before

    else:
        raise ValueError("Invalid transaction type")

    variant.stock_qty = after

    db.add(
        StockTransaction(
            variant_id=variant.id,
            txn_type=txn_type,
            qty_change=qty_change,
            qty_before=before,
            qty_after=after,
            reference_type=reference_type,
            reference_id=reference_id,
            note=note,
            created_by_id=created_by_id,
        )
    )

    return after