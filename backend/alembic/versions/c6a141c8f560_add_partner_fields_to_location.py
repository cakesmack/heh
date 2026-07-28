"""Add partner fields to Location

Revision ID: c6a141c8f560
Revises: f506de5cf913
Create Date: 2026-07-28 18:24:47.298132

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = 'c6a141c8f560'
down_revision: Union[str, Sequence[str], None] = 'f506de5cf913'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('locations', sa.Column('partner_logo', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True))
    op.add_column('locations', sa.Column('partner_url', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True))
    op.add_column('locations', sa.Column('partner_name', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('locations', 'partner_name')
    op.drop_column('locations', 'partner_url')
    op.drop_column('locations', 'partner_logo')
