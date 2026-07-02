"""add_stock_transactions

Revision ID: 86e55ba69374
Revises: 734e287176b2
Create Date: 2026-06-29 06:24:48.249493

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '86e55ba69374'
down_revision: Union[str, None] = '734e287176b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    stocktxntype = sa.Enum('in', 'out', 'adjustment', name='stocktxntype', create_type=False)
    op.create_table('stock_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('variant_id', sa.Integer(), nullable=False),
        sa.Column('txn_type', stocktxntype, nullable=False),
        sa.Column('qty_change', sa.Integer(), nullable=False),
        sa.Column('qty_before', sa.Integer(), nullable=False),
        sa.Column('qty_after', sa.Integer(), nullable=False),
        sa.Column('reference_type', sa.String(length=50), nullable=True),
        sa.Column('reference_id', sa.String(length=100), nullable=True),
        sa.Column('note', sa.String(length=500), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stock_transactions_variant_id'), 'stock_transactions', ['variant_id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_stock_transactions_variant_id'), table_name='stock_transactions')
    op.drop_table('stock_transactions')
