"""make customer_id nullable on sales_invoices

Revision ID: b06770d80563
Revises: 0d13d8d7b3c9
Create Date: 2026-07-20 07:38:28.004651

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b06770d80563'
down_revision: Union[str, None] = '0d13d8d7b3c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.alter_column("sales_invoices", "customer_id", existing_type=sa.Integer(), nullable=True)

def downgrade():
    op.alter_column("sales_invoices", "customer_id", existing_type=sa.Integer(), nullable=False)