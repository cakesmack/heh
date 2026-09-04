"""add_view_count_and_link_click_count_to_collections

Revision ID: e5f6a7b8c901
Revises: d4e5f6a7b8c9
Create Date: 2026-09-04 23:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c901'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE collections ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0 NOT NULL;"
    )
    op.execute(
        "ALTER TABLE collections ADD COLUMN IF NOT EXISTS link_click_count INTEGER DEFAULT 0 NOT NULL;"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE collections DROP COLUMN IF EXISTS view_count;"
    )
    op.execute(
        "ALTER TABLE collections DROP COLUMN IF EXISTS link_click_count;"
    )
