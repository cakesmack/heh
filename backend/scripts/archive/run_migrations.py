
import os
import sys
from sqlalchemy import create_engine, text, inspect

# Add backend directory to python path
backend_dir = os.path.join(os.getcwd())
sys.path.append(backend_dir)

from app.core.config import settings

def run_migrations():
    print(f"Checking database migrations...")
    try:
        # 1. Fix Database URL for SQLAlchemy (Postgres requires postgresql://)
        db_url = str(settings.DATABASE_URL)
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
            
        engine = create_engine(db_url)
        
        # 2. Use Inspector to check columns reliably
        inspector = inspect(engine)
        
        # Check if table exists first
        if not inspector.has_table("venues"):
            print("Table 'venues' does not exist! Skipping migration (fresh install?).")
            return

        columns = [c['name'] for c in inspector.get_columns("venues")]
        print(f"Existing columns in 'venues': {columns}")

        if 'google_place_id' not in columns:
            print("Column 'google_place_id' missing. Adding it...")
            with engine.connect() as connection:
                connection.execute(text("ALTER TABLE venues ADD COLUMN google_place_id VARCHAR(255)"))
                print("Column 'google_place_id' added.")
                
                # Add Index
                try:
                    print("Creating index 'ix_venues_google_place_id'...")
                    connection.execute(text("CREATE UNIQUE INDEX ix_venues_google_place_id ON venues (google_place_id)"))
                    print("Index created.")
                except Exception as e:
                    print(f"Index creation warning (might exist): {e}")

                connection.commit()
                print("Migration 'add_google_place_id' successful.")
        else:
            print("Column 'google_place_id' already exists. Verified by Inspector.")
            
    except Exception as e:
        print(f"CRITICAL: Migration script failed: {e}")
        # We generally want to fail hard if migration fails
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()
