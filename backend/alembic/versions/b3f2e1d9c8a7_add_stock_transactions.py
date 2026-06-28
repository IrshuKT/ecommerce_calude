"""add_stock_transactions

Revision ID: b3f2e1d9c8a7
Revises: a716bc43f970
Create Date: 2026-06-27 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "b3f2e1d9c8a7"
down_revision: Union[str, None] = "a716bc43f970"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stock_transactions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("variant_id", sa.Integer, sa.ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("txn_type", sa.Enum("in", "out", "adjustment", name="stocktxntype"), nullable=False),
        sa.Column("qty_change", sa.Integer, nullable=False),          # +ve = in, -ve = out/adjustment
        sa.Column("qty_before", sa.Integer, nullable=False),
        sa.Column("qty_after", sa.Integer, nullable=False),
        sa.Column("reference_type", sa.String(50), nullable=True),    # "order", "purchase", "manual"
        sa.Column("reference_id", sa.String(100), nullable=True),     # order_number or PO number
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("stock_transactions")
    op.execute("DROP TYPE IF EXISTS stocktxntype")