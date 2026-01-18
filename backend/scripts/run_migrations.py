
import os
import sys
from sqlalchemy import create_engine, text

# Add backend directory to python path
backend_dir = os.path.join(os.getcwd())
sys.path.append(backend_dir)

from app.core.config import settings

def run_migrations():
    print(f"Checking database migrations...")
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as connection:
        # 1. Check for google_place_id
        try:
            print("Checking for 'google_place_id' column in 'venues'...")
            # Try to select the column
            connection.execute(text("SELECT google_place_id FROM venues LIMIT 1"))
            print("Column 'google_place_id' already exists. Skipping.")
        except Exception:
            print("Column 'google_place_id' not found. Adding it...")
            try:
                # Add Column
                connection.execute(text("ALTER TABLE venues ADD COLUMN google_place_id VARCHAR(255)"))
                print("Column added.")
                
                # Add Index
                # Note: Postgres vs SQLite syntax might differ slightly for index if not exists, 
                # but standard CREATE UNIQUE INDEX usually fails if exists.
                # We'll try it and ignore if fails (or check if exists first).
                try:
                    print("Creating index 'ix_venues_google_place_id'...")
                    connection.execute(text("CREATE UNIQUE INDEX ix_venues_google_place_id ON venues (google_place_id)"))
                    print("Index created.")
                except Exception as e:
                    print(f"Index creation failed (likely exists): {e}")

                connection.commit()
                print("Migration 'add_google_place_id' successful.")
            except Exception as e:
                print(f"Migration failed: {e}")
                raise e

if __name__ == "__main__":
    run_migrations()
