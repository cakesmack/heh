"""Add pending_events table

Revision ID: f506de5cf913
Revises: 257747883830
Create Date: 2026-07-24 21:52:21.423926

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f506de5cf913'
down_revision: Union[str, Sequence[str], None] = '257747883830'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the pending_events staging table."""
    op.create_table(
        'pending_events',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.String(length=20000), nullable=False),
        sa.Column('date_start', sa.DateTime(), nullable=False),
        sa.Column('date_end', sa.DateTime(), nullable=True),
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column('ticket_url', sa.String(length=500), nullable=True),
        sa.Column('price_display', sa.String(length=100), nullable=True),
        sa.Column('min_price', sa.Float(), nullable=True),
        sa.Column('age_restriction', sa.String(length=50), nullable=True),
        sa.Column('min_age', sa.Integer(), nullable=True),
        sa.Column('venue_name', sa.String(length=255), nullable=False),
        sa.Column('category_name', sa.String(length=255), nullable=False),
        sa.Column('source', sa.String(length=100), nullable=False),
        sa.Column('raw_showtimes', sa.JSON(), nullable=True),
        sa.Column('import_status', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_pending_events_title'), 'pending_events', ['title'], unique=False)
    op.create_index(op.f('ix_pending_events_date_start'), 'pending_events', ['date_start'], unique=False)
    op.create_index(op.f('ix_pending_events_source'), 'pending_events', ['source'], unique=False)
    op.create_index(op.f('ix_pending_events_import_status'), 'pending_events', ['import_status'], unique=False)


def downgrade() -> None:
    """Drop the pending_events staging table."""
    op.drop_index(op.f('ix_pending_events_import_status'), table_name='pending_events')
    op.drop_index(op.f('ix_pending_events_source'), table_name='pending_events')
    op.drop_index(op.f('ix_pending_events_date_start'), table_name='pending_events')
    op.drop_index(op.f('ix_pending_events_title'), table_name='pending_events')
    op.drop_table('pending_events')

