
import os
import sys
from sqlalchemy import create_engine, text

# Add backend directory to python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)

from app.core.config import settings

def migrate():
    print(f"Connecting to database...")
    db_url = str(settings.DATABASE_URL)
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    engine = create_engine(db_url)
    
    with engine.connect() as connection:
        # Check if column exists
        try:
            # We check safely using a select (this assumes table exists)
            connection.execute(text("SELECT status FROM venues LIMIT 1"))
            print("Column 'status' already exists. Skipping.")
        except Exception:
            print("Column 'status' not found. Adding it...")
            
            try:
                # Add column
                connection.execute(text("ALTER TABLE venues ADD COLUMN status VARCHAR(50) DEFAULT 'unverified'"))
                # Update existing
                connection.execute(text("UPDATE venues SET status = 'verified' WHERE status = 'unverified'"))
                connection.commit()
                print("Migration successful.")
            except Exception as e:
                print(f"Error executing migration: {e}")
                
if __name__ == "__main__":
    migrate()
