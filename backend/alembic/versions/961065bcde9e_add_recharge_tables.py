"""add recharge tables

Revision ID: 961065bcde9e
Revises: b06770d80563
Create Date: 2026-07-21 06:09:47.460474

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '961065bcde9e'
down_revision: Union[str, None] = 'b06770d80563'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        'recharge_entries',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('operator', sa.Enum('jio', 'airtel', 'vi', 'bsnl', name='rechargeoperator'), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('notes', sa.String(200), nullable=True),
        sa.Column('cashier_id', sa.Integer(), sa.ForeignKey('internal_users.id'), nullable=True),
        sa.Column('journal_id', sa.Integer(), sa.ForeignKey('journals.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'recharge_wallet_topups',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('operator', sa.Enum('jio', 'airtel', 'vi', 'bsnl', name='rechargeoperator'), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('topup_date', sa.Date(), nullable=False),
        sa.Column('payment_mode', sa.String(30), nullable=False),
        sa.Column('notes', sa.String(200), nullable=True),
        sa.Column('journal_id', sa.Integer(), sa.ForeignKey('journals.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'recharge_commissions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('operator', sa.Enum('jio', 'airtel', 'vi', 'bsnl', name='rechargeoperator'), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('period_month', sa.Integer(), nullable=False),
        sa.Column('period_year', sa.Integer(), nullable=False),
        sa.Column('received_date', sa.Date(), nullable=False),
        sa.Column('payment_mode', sa.String(30), nullable=False),
        sa.Column('notes', sa.String(200), nullable=True),
        sa.Column('journal_id', sa.Integer(), sa.ForeignKey('journals.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Seed the wallet + commission ledger accounts these tables' journals post to
    op.execute("""
        INSERT INTO accounts (code, name, account_type, is_system, is_active, created_at) VALUES
        ('1401', 'Recharge Wallet - Jio', 'asset', true, true, now()),
        ('1402', 'Recharge Wallet - Airtel', 'asset', true, true, now()),
        ('1403', 'Recharge Wallet - Vi', 'asset', true, true, now()),
        ('1404', 'Recharge Wallet - BSNL', 'asset', true, true, now()),
        ('4201', 'Recharge Commission - Jio', 'income', true, true, now()),
        ('4202', 'Recharge Commission - Airtel', 'income', true, true, now()),
        ('4203', 'Recharge Commission - Vi', 'income', true, true, now()),
        ('4204', 'Recharge Commission - BSNL', 'income', true, true, now())
    """)


def downgrade():
    op.execute("""
        DELETE FROM accounts WHERE code IN
        ('1401', '1402', '1403', '1404', '4201', '4202', '4203', '4204')
    """)
    op.drop_table('recharge_commissions')
    op.drop_table('recharge_wallet_topups')
    op.drop_table('recharge_entries')
    op.execute("DROP TYPE IF EXISTS rechargeoperator")
