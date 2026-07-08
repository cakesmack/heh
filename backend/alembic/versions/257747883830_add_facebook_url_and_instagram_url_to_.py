"""add facebook_url and instagram_url to venues

Revision ID: 257747883830
Revises: 8a699a46d724
Create Date: 2026-07-08 20:50:03.788094

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '257747883830'
down_revision: Union[str, Sequence[str], None] = '8a699a46d724'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('venues', sa.Column('facebook_url', sa.String(length=500), nullable=True))
    op.add_column('venues', sa.Column('instagram_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('venues', 'facebook_url')
    op.drop_column('venues', 'instagram_url')
