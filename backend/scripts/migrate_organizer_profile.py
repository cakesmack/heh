"""
Migration script: Add enhanced organizer profile fields
Run this to add new columns to the organizers table for Part 2 of the upgrade.

Usage:
    cd backend
    python scripts/migrate_organizer_profile.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, text
from app.core.database import engine

def run_migration():
    """Add new organizer profile fields"""
    
    columns_to_add = [
        ("cover_image_url", "VARCHAR(500)"),
        ("city", "VARCHAR(100)"),
        ("social_facebook", "VARCHAR(500)"),
        ("social_instagram", "VARCHAR(500)"),
        ("social_website", "VARCHAR(500)"),
        ("public_email", "VARCHAR(255)"),
    ]
    
    with Session(engine) as session:
        # Check existing columns
        result = session.exec(text("PRAGMA table_info(organizers)"))
        existing_columns = {row[1] for row in result.fetchall()}
        
        for column_name, column_type in columns_to_add:
            if column_name in existing_columns:
                print(f"✓ Column '{column_name}' already exists")
            else:
                try:
                    session.exec(text(f"ALTER TABLE organizers ADD COLUMN {column_name} {column_type}"))
                    session.commit()
                    print(f"✓ Added column '{column_name}'")
                except Exception as e:
                    print(f"✗ Failed to add '{column_name}': {e}")
        
        print("\n✅ Migration complete!")
        
        # Verify
        result = session.exec(text("PRAGMA table_info(organizers)"))
        print("\nCurrent organizers table columns:")
        for row in result.fetchall():
            print(f"  - {row[1]} ({row[2]})")

if __name__ == "__main__":
    print("=" * 50)
    print("Organizer Profile Fields Migration")
    print("=" * 50)
    run_migration()
