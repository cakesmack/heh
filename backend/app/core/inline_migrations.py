"""
Inline database migrations.

These idempotent ALTER TABLE / INSERT statements run on every startup.
They are Postgres-only (skipped for SQLite).

Extracted from main.py lifespan to keep the entry point lean.
"""
import logging
from sqlalchemy import text
from sqlmodel import Session

logger = logging.getLogger(__name__)


def run_inline_migrations(session: Session) -> None:
    """Execute all idempotent inline migrations."""

    # --- Event columns ---
    session.exec(text(
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS website_url VARCHAR(500);"
    ))
    session.exec(text(
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT FALSE;"
    ))

    # --- Recurring event columns ---
    session.exec(text(
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;"
    ))
    session.exec(text(
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_rule VARCHAR(500);"
    ))
    session.exec(text(
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS parent_event_id VARCHAR(50);"
    ))
    session.exec(text(
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_group_id VARCHAR(50);"
    ))

    # --- Triptych Hero columns ---
    session.exec(text(
        "ALTER TABLE hero_slots ADD COLUMN IF NOT EXISTS image_override_left VARCHAR(500);"
    ))
    session.exec(text(
        "ALTER TABLE hero_slots ADD COLUMN IF NOT EXISTS image_override_right VARCHAR(500);"
    ))

    # --- Venue columns ---
    session.exec(text(
        "ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN DEFAULT FALSE;"
    ))

    # --- Hero 4-Slot Magazine columns ---
    session.exec(text(
        "ALTER TABLE hero_slots ADD COLUMN IF NOT EXISTS link VARCHAR(500);"
    ))
    session.exec(text(
        "ALTER TABLE hero_slots ADD COLUMN IF NOT EXISTS badge_text VARCHAR(50);"
    ))
    session.exec(text(
        "ALTER TABLE hero_slots ADD COLUMN IF NOT EXISTS badge_color VARCHAR(50) DEFAULT 'emerald';"
    ))

    # --- Initialize 4 Fixed Hero Slots (positions 0-3) ---
    for i in range(4):
        result = session.exec(
            text(f"SELECT id FROM hero_slots WHERE position = {i}")
        ).first()
        if not result:
            session.exec(text(f"""
                INSERT INTO hero_slots (position, type, is_active, badge_color, overlay_style)
                VALUES ({i}, 'spotlight_event', false, 'emerald', 'dark')
            """))
            logger.info("Initialized Hero Slot position %d", i)

    # --- Analytics counter columns ---
    session.exec(text(
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;"
    ))
    session.exec(text(
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS attending_count INTEGER DEFAULT 0;"
    ))
    session.exec(text(
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_click_count INTEGER DEFAULT 0;"
    ))

    # --- Backfill created_at for Magazine Feed ---
    # Clamp to NOW() to prevent future events from burying new creations.
    session.exec(text("""
        UPDATE events 
        SET created_at = CASE 
            WHEN created_at IS NULL THEN LEAST(date_start, NOW())
            WHEN created_at > NOW() THEN NOW()
            ELSE created_at
        END
        WHERE created_at IS NULL OR created_at > NOW();
    """))

    session.commit()
    logger.info("Inline migrations complete")
