"""add pos_sale voucher type and pos journal_id

Revision ID: 7952c5122108
Revises: ed11b94f8072
Create Date: 2026-07-08 07:22:23.112896

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '7952c5122108'
down_revision: Union[str, None] = 'ed11b94f8072'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Adding a value to a Postgres enum can't run inside the same transaction
    # as other statements that might use it — use autocommit_block for this part.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE vouchertype ADD VALUE IF NOT EXISTS 'pos_sale'")

    op.add_column('pos_sales', sa.Column('journal_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'pos_sales_journal_id_fkey', 'pos_sales', 'journals', ['journal_id'], ['id']
    )


def downgrade():
    op.drop_constraint('pos_sales_journal_id_fkey', 'pos_sales', type_='foreignkey')
    op.drop_column('pos_sales', 'journal_id')
    # Postgres doesn't support removing enum values, so downgrade can't fully
    # undo the ALTER TYPE step — this is a one-way migration in that respect.
