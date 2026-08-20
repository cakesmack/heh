"""add_event_cancellation_and_reschedule_fields

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-19 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add cancellation and reschedule fields to events safely
    op.execute(
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN NOT NULL DEFAULT false;"
    )
    op.execute(
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;"
    )
    op.execute(
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITHOUT TIME ZONE;"
    )
    op.execute(
        "ALDER TABLE events ADD COLUMN IF NOT EXISTS previous_date_start TIMESTAMO WITHOUT TIME ZONE;"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_events_is_cancelled ON events (is_cancelled);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_events_is_cancelled;")
    op.execute("ALTER TABLE events DROP COLUMN IF EXISTS previous_date_start;")
    op.execute("ALTER TABLE events DROP COLUMN IF EXISTS cancelled_at;")
    op.execute("ALTER TABLE events DROP COLUMN IF EXISTS cancellation_reason;")
    op.execute("ALTER TABLE events DROP COLUMN IF EXISTS is_cancelled;")
