"""
Migration Bridge — Render Release Command
Cleans duplicate events and applies a UNIQUE constraint.
Fully idempotent: safe to run multiple times.

Usage (Render Release Command):
    python scripts/deploy_fix.py
"""
import os
import sys

from sqlalchemy import create_engine, text


def main() -> None:
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        print("[deploy_fix] DATABASE_URL not set — aborting.")
        sys.exit(1)

    # Fix Render's postgres:// scheme for SQLAlchemy
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(database_url)

    with engine.begin() as conn:
        # ── Idempotency check ──────────────────────────────────
        result = conn.execute(text("""
            SELECT 1
            FROM   information_schema.table_constraints
            WHERE  constraint_name = 'uq_event_title_date_venue'
              AND  table_name      = 'events';
        """))

        if result.fetchone():
            print("[deploy_fix] Constraint uq_event_title_date_venue already exists — nothing to do.")
            return

        # ── Step 1: Delete duplicates (keep oldest ID) ─────────
        deleted = conn.execute(text("""
            DELETE FROM events
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY title, date_start, venue_id
                               ORDER BY id ASC
                           ) AS row_num
                    FROM events
                ) ranked
                WHERE ranked.row_num > 1
            );
        """))
        print(f"[deploy_fix] Deleted {deleted.rowcount} duplicate event(s).")

        # ── Step 2: Apply UNIQUE constraint ────────────────────
        conn.execute(text("""
            ALTER TABLE events
            ADD CONSTRAINT uq_event_title_date_venue
            UNIQUE (title, date_start, venue_id);
        """))
        print("[deploy_fix] UNIQUE constraint uq_event_title_date_venue applied successfully.")

    print("[deploy_fix] Migration bridge complete.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[deploy_fix] FATAL — rolled back all changes: {exc}")
        sys.exit(1)
