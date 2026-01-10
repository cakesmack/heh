"""
Migration Script: Add receive_interest_notifications to users table
Run this script to add the notification preferences column for the Personalization Engine.

Usage: python scripts/migrate_interest_notifications.py
"""

import os
import sys

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, inspect

def get_database_url():
    """Get database URL from environment or use default SQLite."""
    return os.environ.get("DATABASE_URL", "sqlite:///./highland_events.db")

def run_migration():
    """Run the database migration."""
    database_url = get_database_url()
    
    # Handle Render's postgres:// URL format
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    print(f"Connecting to database...")
    engine = create_engine(database_url)
    
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns('users')]
    
    print(f"Current users columns: {columns}")
    
    with engine.begin() as conn:
        # Add receive_interest_notifications column if it doesn't exist
        if 'receive_interest_notifications' not in columns:
            print("Adding receive_interest_notifications column...")
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN receive_interest_notifications BOOLEAN DEFAULT TRUE"
            ))
            print("Column added successfully!")
        else:
            print("Column 'receive_interest_notifications' already exists, skipping...")
        
        # Ensure all existing users have the default value
        print("Setting default value for existing users...")
        conn.execute(text(
            "UPDATE users SET receive_interest_notifications = TRUE WHERE receive_interest_notifications IS NULL"
        ))
    
    print("\nMigration complete!")
    print("\nChanges made:")
    print("  - Added 'receive_interest_notifications' BOOLEAN column to users table")
    print("  - Default value: TRUE (users receive notifications by default)")

if __name__ == "__main__":
    run_migration()
