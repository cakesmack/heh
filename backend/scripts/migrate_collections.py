#!/usr/bin/env python
"""
Database migration script: Add fixed_start_date and fixed_end_date to collections table.

This script was moved from an API endpoint for security reasons.
Database migrations should be run via CLI, not exposed via HTTP.

Usage:
    python scripts/migrate_collections.py

Requirements:
    - DATABASE_URL environment variable must be set
    - Or run from the backend directory with .env file present
"""
import os
import sys

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import get_session


def migrate_collections_table():
    """Add fixed_start_date and fixed_end_date columns to collections table."""
    session = next(get_session())
    results = []
    
    try:
        # Check if columns exist
        check_query = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'collections' 
            AND column_name IN ('fixed_start_date', 'fixed_end_date')
        """)
        existing = [row[0] for row in session.exec(check_query).fetchall()]
        
        if 'fixed_start_date' not in existing:
            session.exec(text("ALTER TABLE collections ADD COLUMN fixed_start_date DATE DEFAULT NULL"))
            results.append("Added fixed_start_date column")
        else:
            results.append("fixed_start_date already exists")
        
        if 'fixed_end_date' not in existing:
            session.exec(text("ALTER TABLE collections ADD COLUMN fixed_end_date DATE DEFAULT NULL"))
            results.append("Added fixed_end_date column")
        else:
            results.append("fixed_end_date already exists")
        
        session.commit()
        
        print("Migration completed successfully!")
        for result in results:
            print(f"  - {result}")
            
    except Exception as e:
        session.rollback()
        print(f"Migration failed: {e}")
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    print("Running collections table migration...")
    migrate_collections_table()
