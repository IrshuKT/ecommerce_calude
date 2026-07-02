"""add number_sequences table

Revision ID: 66b3766a8915
Revises: 483056287b4a
Create Date: 2026-07-01 22:37:10.977226

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '66b3766a8915'
down_revision: Union[str, None] = '483056287b4a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        "number_sequences",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("doc_type", sa.String(20), nullable=False),
        sa.Column("financial_year", sa.String(10), nullable=False),
        sa.Column("last_number", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("doc_type", "financial_year", name="uq_seq_doctype_fy"),
    )

def downgrade():
    op.drop_table("number_sequences")