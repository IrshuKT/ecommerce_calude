"""add pos_sale_id to sales_invoices

Revision ID: 0d13d8d7b3c9
Revises: 0c1e39dbb9cb
Create Date: 2026-07-20 07:24:58.612532

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '0d13d8d7b3c9'
down_revision: Union[str, None] = '0c1e39dbb9cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column("sales_invoices", sa.Column("pos_sale_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_sales_invoices_pos_sale_id", "sales_invoices", "pos_sales",
        ["pos_sale_id"], ["id"],
    )
    op.create_unique_constraint("uq_sales_invoices_pos_sale_id", "sales_invoices", ["pos_sale_id"])

def downgrade():
    op.drop_constraint("uq_sales_invoices_pos_sale_id", "sales_invoices", type_="unique")
    op.drop_constraint("fk_sales_invoices_pos_sale_id", "sales_invoices", type_="foreignkey")
    op.drop_column("sales_invoices", "pos_sale_id")