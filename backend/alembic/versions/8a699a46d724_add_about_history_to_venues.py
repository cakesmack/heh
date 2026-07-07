"""add about_history to venues

Revision ID: 8a699a46d724
Revises: 6daaeeecd963
Create Date: 2026-07-07 19:38:58.277570

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8a699a46d724'
down_revision: Union[str, Sequence[str], None] = '6daaeeecd963'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('venues', sa.Column('about_history', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('venues', 'about_history')
