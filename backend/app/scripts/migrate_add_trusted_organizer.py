"""
Migration script to add is_trusted_organizer column to users table.
Also creates the featured_bookings table if it doesn't exist.

Run once: cd backend && python -m app.scripts.migrate_add_trusted_organizer
"""
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from sqlmodel import SQLModel
from app.core.database import engine
from app.models.featured_booking import FeaturedBooking  # Import to register model


def run_migration():
    """Add is_trusted_organizer column and create featured_bookings table."""

    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name = 'is_trusted_organizer'
        """))

        if result.fetchone() is None:
            print("Adding is_trusted_organizer column to users table...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN is_trusted_organizer BOOLEAN DEFAULT FALSE
            """))
            conn.commit()
            print("Column added successfully!")
        else:
            print("Column is_trusted_organizer already exists")

        # Check if featured_bookings table exists
        result = conn.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name = 'featured_bookings'
        """))

        if result.fetchone() is None:
            print("Creating featured_bookings table...")
            SQLModel.metadata.create_all(engine, tables=[FeaturedBooking.__table__])
            print("Table created successfully!")
        else:
            print("Table featured_bookings already exists")

    print("Migration complete!")


if __name__ == "__main__":
    run_migration()
