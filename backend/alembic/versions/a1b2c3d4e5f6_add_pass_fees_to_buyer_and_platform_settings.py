"""add_pass_fees_to_buyer_and_platform_settings

Revision ID: a1b2c3d4e5f6
Revises: e9b6ba72632d
Create Date: 2026-08-16 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'e9b6ba72632d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add pass_fees_to_buyer column to events table safely
    op.execute(
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS pass_fees_to_buyer BOOLEAN NOT NULL DEFAULT false;"
    )

    # 2. Create platform_settings table safely
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS platform_settings (
            id VARCHAR NOT NULL PRIMARY KEY,
            base_percentage FLOAT NOT NULL DEFAULT 3.5,
            base_flat_fee FLOAT NOT NULL DEFAULT 0.30,
            hard_cap_amount FLOAT NOT NULL DEFAULT 75.00,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
        );
        """
    )

    # 3. Seed default global row
    op.execute(
        """
        INSERT INTO platform_settings (id, base_percentage, base_flat_fee, hard_cap_amount, updated_at)
        VALUES ('global', 3.5, 0.30, 75.00, NOW())
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE events DROP COLUMN IF EXISTS pass_fees_to_buyer;")
    op.execute("DROP TABLE IF EXISTS platform_settings;")
