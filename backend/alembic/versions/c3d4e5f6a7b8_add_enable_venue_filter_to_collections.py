"""add_enable_venue_filter_to_collections

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-04 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE collections ADD COLUMN IF NOT EXISTS enable_venue_filter BOOLEAN NOT NULL DEFAULT false;"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE collections DROP COLUMN IF EXISTS enable_venue_filter;"
    )
