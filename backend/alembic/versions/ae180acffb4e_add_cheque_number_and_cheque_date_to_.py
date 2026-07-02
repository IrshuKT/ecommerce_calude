"""add cheque_number and cheque_date to receipt and payment vouchers

Revision ID: ae180acffb4e
Revises: 66b3766a8915
Create Date: 2026-07-02 11:03:50.551522

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'ae180acffb4e'
down_revision: Union[str, None] = '66b3766a8915'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('receipt_vouchers', sa.Column('cheque_number', sa.String(length=50), nullable=True))
    op.add_column('receipt_vouchers', sa.Column('cheque_date', sa.Date(), nullable=True))
    op.add_column('payment_vouchers', sa.Column('cheque_number', sa.String(length=50), nullable=True))
    op.add_column('payment_vouchers', sa.Column('cheque_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('payment_vouchers', 'cheque_date')
    op.drop_column('payment_vouchers', 'cheque_number')
    op.drop_column('receipt_vouchers', 'cheque_date')
    op.drop_column('receipt_vouchers', 'cheque_number')
