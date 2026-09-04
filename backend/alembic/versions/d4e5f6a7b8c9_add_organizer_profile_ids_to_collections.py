"""add_organizer_profile_ids_to_collections

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-04 22:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE collections ADD COLUMN IF NOT EXISTS organizer_profile_ids JSONB;"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE collections DROP COLUMN IF EXISTS organizer_profile_ids;"
    )
