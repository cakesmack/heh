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

    # --- pg_trgm extension for fuzzy title matching ---
    try:
        session.exec(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))
        session.exec(text(
            "CREATE INDEX IF NOT EXISTS idx_events_title_trgm "
            "ON events USING gin (title gin_trgm_ops);"
        ))
    except Exception as e:
        logger.warning("pg_trgm setup skipped (non-critical): %s", e)

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

    # --- Venue columns ---
    session.exec(text(
        "ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN DEFAULT FALSE;"
    ))

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

    # --- User enhancements (Admin Phase) ---
    try:
        session.exec(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITHOUT TIME ZONE;"))
        session.exec(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes VARCHAR(5000);"))
    except Exception as e:
        logger.warning(f"User migration skipped: {e}")

    # --- Organizer enhancements ---
    try:
        session.exec(text("ALTER TABLE organizers ADD COLUMN IF NOT EXISTS group_type VARCHAR(50);"))
        session.exec(text("ALTER TABLE organizers ADD COLUMN IF NOT EXISTS category_focus VARCHAR(50);"))
        session.exec(text("ALTER TABLE organizers ADD COLUMN IF NOT EXISTS upcoming_events_count INTEGER DEFAULT 0;"))
        session.exec(text("ALTER TABLE organizers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;"))
    except Exception as e:
        logger.warning(f"Organizer migration skipped: {e}")

    # --- notificationtype enum update ---
    try:
        session.commit()
        connection = session.connection()
        autocommit_conn = connection.execution_options(isolation_level="AUTOCOMMIT")
        autocommit_conn.execute(text("ALTER TYPE notificationtype ADD VALUE 'NEW_CLAIM';"))
    except Exception as e:
        if "already exists" not in str(e).lower():
            logger.warning("Could not add NEW_CLAIM to notificationtype enum: %s", e)

    session.commit()
    logger.info("Inline migrations complete")
