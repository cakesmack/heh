"""add contact_number to organizers

Revision ID: 6daaeeecd963
Revises: 2b4255d70229
Create Date: 2026-07-05 16:55:35.937833

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6daaeeecd963'
down_revision: Union[str, Sequence[str], None] = '2b4255d70229'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('organizers', sa.Column('contact_number', sa.String(length=50), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('organizers', 'contact_number')
