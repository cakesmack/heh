"""
Migration script to add custom_subtitle column to featured_bookings table.
This allows users to set a custom subtitle for hero carousel featured events.

Run once: cd backend && python -m app.scripts.migrate_featured_subtitle
"""
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from app.core.database import engine


def run_migration():
    """Add custom_subtitle column to featured_bookings table."""

    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'featured_bookings'
            AND column_name = 'custom_subtitle'
        """))

        if result.fetchone() is None:
            print("Adding custom_subtitle column to featured_bookings table...")
            conn.execute(text("""
                ALTER TABLE featured_bookings
                ADD COLUMN custom_subtitle VARCHAR(200)
            """))
            conn.commit()
            print("Column added successfully!")
        else:
            print("Column custom_subtitle already exists")

    print("Migration complete!")


if __name__ == "__main__":
    run_migration()
