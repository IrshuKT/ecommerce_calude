"""merge pos and product branches

Revision ID: ef563e18edeb
Revises: 256c07632736, d65b576fe4f7
Create Date: 2026-07-11 09:24:00.398548

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'ef563e18edeb'
down_revision: Union[str, None] = ('256c07632736', 'd65b576fe4f7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
