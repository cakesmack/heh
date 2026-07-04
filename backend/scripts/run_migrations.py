import os
import sys
import glob
from sqlalchemy import create_engine, text
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
                    
                    try:
                        # PostgreSQL does not allow ALTER TYPE ... ADD VALUE inside a transaction block.
                        # If the script contains ALTER TYPE ADD VALUE, we execute it in AUTOCOMMIT mode.
                        if "ALTER TYPE" in sql_script.upper() and "ADD VALUE" in sql_script.upper():
                            print("  (Executing in AUTOCOMMIT mode for ALTER TYPE statement)")
                            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as autocommit_conn:
                                autocommit_conn.execute(text(sql_script))
                            
                            # Log the applied migration using standard connection
                            connection.execute(
                                text("INSERT INTO schema_migrations (filename) VALUES (:filename)"),
                                {"filename": filename}
                            )
                            connection.commit()
                        else:
                            connection.execute(text(sql_script))
                            connection.execute(
                                text("INSERT INTO schema_migrations (filename) VALUES (:filename)"),
                                {"filename": filename}
                            )
                            connection.commit()
                        print(f"Successfully applied {filename}")
                    except Exception as e:
                        connection.rollback()
                        print(f"Failed to apply {filename}: {e}")
                        sys.exit(1)
                else:
                    print(f"Skipping {filename} (already applied)")
            
            # 5. Run inline migrations (such as adding columns in Postgres)
            print("Checking inline database migrations...")
            try:
                connection.execute(text("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL
                """))
                connection.execute(text("""
                    UPDATE users SET is_active = FALSE WHERE email = 'banned@test.com'
                """))
                connection.commit()
                print("[SUCCESS] Inline migrations: is_active column and banned status ensured on users table")
            except Exception as e:
                connection.rollback()
                print(f"Inline migrations note: {e}")

        # 6. Seed slot pricing defaults
        try:
            print("Running slot pricing seeding...")
            from app.scripts.migrate_slot_pricing import run_migration as run_pricing_seeding
            run_pricing_seeding()
            print("[SUCCESS] Slot pricing seeding complete")
        except Exception as e:
            print(f"Failed to seed slot pricing: {e}")

        # 7. Backfill user preferences
        try:
            print("Running user preferences backfill...")
            from app.scripts.backfill_preferences import backfill_preferences
            backfill_preferences()
            print("[SUCCESS] User preferences backfill complete")
        # 8. Uncategorized venues migration
        try:
            print("Running uncategorized venues migration...")
            from scripts.migrate_uncategorized_venues import run_migration as run_uncategorized_migration
            run_uncategorized_migration()
            print("[SUCCESS] Uncategorized venues migration complete")
        except Exception as e:
            print(f"Note on uncategorized migration: {e}")

    except Exception as e:
        print(f"CRITICAL: Migration script failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()
