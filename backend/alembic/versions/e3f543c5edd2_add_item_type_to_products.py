"""add item_type to products

Revision ID: e3f543c5edd2
Revises: 7f6fe4f2e354
Create Date: 2026-07-07 10:05:40.306782

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e3f543c5edd2'
down_revision: Union[str, None] = '7f6fe4f2e354'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    # 1. Create the Postgres enum type explicitly
    producttype_enum = sa.Enum('product', 'service', name='producttype')
    producttype_enum.create(op.get_bind(), checkfirst=True)

    # 2. Now add the column, referencing the type without re-creating it
    op.add_column(
        'products',
        sa.Column(
            'item_type',
            sa.Enum('product', 'service', name='producttype', create_type=False),
            nullable=False,
            server_default='product',   # ← also needed since existing rows must get a value
        )
    )

    # Optional: drop the server_default afterward if you don't want new inserts relying on it
    # op.alter_column('products', 'item_type', server_default=None)


def downgrade():
    op.drop_column('products', 'item_type')
    sa.Enum(name='producttype').drop(op.get_bind(), checkfirst=True)
