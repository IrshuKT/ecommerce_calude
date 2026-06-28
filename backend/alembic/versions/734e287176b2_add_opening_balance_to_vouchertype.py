"""add_opening_balance_to_vouchertype

Revision ID: 734e287176b2
Revises: f666098af449
Create Date: 2026-06-28 22:26:52.423735

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '734e287176b2'
down_revision: Union[str, None] = 'f666098af449'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.execute("ALTER TYPE vouchertype ADD VALUE IF NOT EXISTS 'opening_balance'")

def downgrade():
    pass