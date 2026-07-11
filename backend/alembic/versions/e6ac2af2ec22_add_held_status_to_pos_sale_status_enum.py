"""add held status to pos sale status enum

Revision ID: e6ac2af2ec22
Revises: ef563e18edeb
Create Date: 2026-07-11 09:30:45.407025

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6ac2af2ec22'
down_revision: Union[str, None] = 'ef563e18edeb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE possalestatus ADD VALUE IF NOT EXISTS 'held'")


def downgrade() -> None:
    # Postgres does not support removing a value from an enum type directly.
    # Only attempt this if no rows have status='held' at downgrade time.
    pass