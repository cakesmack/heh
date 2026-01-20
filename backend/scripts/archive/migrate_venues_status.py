
import os
import sys
from sqlalchemy import create_engine, text

# Add backend directory to python path
backend_dir = os.path.join(os.getcwd())
sys.path.append(backend_dir)

from app.core.config import settings

def migrate():
    print(f"Connecting to database...")
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as connection:
        # Check if column exists
        try:
            result = connection.execute(text("SELECT status FROM venues LIMIT 1"))
            print("Column 'status' already exists. Skipping.")
        except Exception:
            print("Column 'status' not found. Adding it...")
            
            # Check dialect
            if engine.dialect.name == 'postgresql':
                    connection.execute(text("ALTER TABLE venues ADD COLUMN status VARCHAR(50) DEFAULT 'unverified'"))
            else:
                    # SQLite
                    connection.execute(text("ALTER TABLE venues ADD COLUMN status VARCHAR(50) DEFAULT 'unverified'"))
            
            # Update existing records to Verified (assuming legacy venues are verified)
            connection.execute(text("UPDATE venues SET status = 'verified' WHERE status = 'unverified'"))
            
            connection.commit()
            print("Migration successful.")


if __name__ == "__main__":
    migrate()
