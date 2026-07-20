"""fix journals created_by_id fkey to internal_users

Revision ID: 965f62da488a
Revises: 52bdaba5c067
Create Date: 2026-07-18 07:44:34.429040

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '965f62da488a'
down_revision: Union[str, None] = '52bdaba5c067'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Null out any orphaned created_by_id values that don't exist in internal_users,
    # so the new FK doesn't fail to create. Safe no-op if there are none.
    op.execute("""
        UPDATE journals
        SET created_by_id = NULL
        WHERE created_by_id IS NOT NULL
          AND created_by_id NOT IN (SELECT id FROM internal_users)
    """)

    op.drop_constraint("journals_created_by_id_fkey", "journals", type_="foreignkey")
    op.create_foreign_key(
        "journals_created_by_id_fkey",
        "journals", "internal_users",
        ["created_by_id"], ["id"],
    )


def downgrade():
    op.drop_constraint("journals_created_by_id_fkey", "journals", type_="foreignkey")
    op.create_foreign_key(
        "journals_created_by_id_fkey",
        "journals", "users",
        ["created_by_id"], ["id"],
    )