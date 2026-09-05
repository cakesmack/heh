"""add_bounding_box_to_collections

Revision ID: f6a7b8c90123
Revises: e5f6a7b8c901
Create Date: 2026-09-05 02:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c90123'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE collections ADD COLUMN IF NOT EXISTS min_lat FLOAT;")
    op.execute("ALTER TABLE collections ADD COLUMN IF NOT EXISTS max_lat FLOAT;")
    op.execute("ALTER TABLE collections ADD COLUMN IF NOT EXISTS min_lng FLOAT;")
    op.execute("ALTER TABLE collections ADD COLUMN IF NOT EXISTS max_lng FLOAT;")


def downgrade() -> None:
    op.execute("ALTER TABLE collections DROP COLUMN IF EXISTS min_lat;")
    op.execute("ALTER TABLE collections DROP COLUMN IF EXISTS max_lat;")
    op.execute("ALTER TABLE collections DROP COLUMN IF EXISTS min_lng;")
    op.execute("ALTER TABLE collections DROP COLUMN IF EXISTS max_lng;")
