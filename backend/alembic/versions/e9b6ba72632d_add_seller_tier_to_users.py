"""add_seller_tier_to_users

Revision ID: e9b6ba72632d
Revises: 9c316f37862e
Create Date: 2026-08-16 15:04:18.569994

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e9b6ba72632d'
down_revision: Union[str, Sequence[str], None] = '9c316f37862e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Ensure seller_tier and seller_status exist on users table
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_tier INTEGER NOT NULL DEFAULT 1;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_status VARCHAR NOT NULL DEFAULT 'none';")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS seller_status;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS seller_tier;")
