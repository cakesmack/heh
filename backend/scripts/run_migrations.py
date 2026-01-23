
import os
import sys
import glob
from sqlalchemy import create_engine, text, inspect
from datetime import datetime

# Add backend directory to python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)

from app.core.config import settings

def run_migrations():
    print(f"Checking database migrations...")
    try:
        # 1. Fix Database URL for SQLAlchemy
        db_url = str(settings.DATABASE_URL)
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
            
        engine = create_engine(db_url)
        
        with engine.connect() as connection:
            # 2. Create schema_migrations table if not exists
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    filename VARCHAR(255) PRIMARY KEY,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            connection.commit()
            
            # 3. Get list of applied migrations
            result = connection.execute(text("SELECT filename FROM schema_migrations"))
            applied_migrations = {row[0] for row in result.fetchall()}
            
            # 4. Get all .sql files in migrations directory
            migrations_dir = os.path.join(backend_dir, "migrations")
            migration_files = sorted(glob.glob(os.path.join(migrations_dir, "*.sql")))
            
            print(f"Found {len(migration_files)} migration files.")
            
            for file_path in migration_files:
                filename = os.path.basename(file_path)
                if filename not in applied_migrations:
                    print(f"Applying migration: {filename}")
                    
                    with open(file_path, 'r') as f:
                        sql_script = f.read()
                        
                    # Execute script
                    # We assume the script might contain multiple statements separated by ;
                    # But SQLAlchemy execute usually handles one statement or a script depending on driver.
                    # For safety with simple migrations, we execute as one block or split if needed.
                    # Here we treat the whole file as one command because usually migrations are single DDLs.
                    # If it fails, it rolls back (transactional DDL in Postgres).
                    
                    trans = connection.begin()
                    try:
                        connection.execute(text(sql_script))
                        connection.execute(text("INSERT INTO schema_migrations (filename) VALUES (:filename)"), {"filename": filename})
                        trans.commit()
                        print(f"Successfully applied {filename}")
                    except Exception as e:
                        trans.rollback()
                        print(f"Failed to apply {filename}: {e}")
                        sys.exit(1)
                else:
                    print(f"Skipping {filename} (already applied)")
                    
    except Exception as e:
        print(f"CRITICAL: Migration script failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()
