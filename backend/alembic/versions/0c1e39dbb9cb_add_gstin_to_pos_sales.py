"""add gstin to pos_sales

Revision ID: 0c1e39dbb9cb
Revises: 965f62da488a
Create Date: 2026-07-18 14:53:14.108889

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '0c1e39dbb9cb'
down_revision: Union[str, None] = '965f62da488a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column("pos_sales", sa.Column("gstin", sa.String(length=15), nullable=True))

def downgrade():
    op.drop_column("pos_sales", "gstin")