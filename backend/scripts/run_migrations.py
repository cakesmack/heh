
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
        
        # =========================================================
        # MIGRATION: Hero Triptych (image_override_left/right)
        # =========================================================
        if inspector.has_table("hero_slots"):
            columns = [c['name'] for c in inspector.get_columns("hero_slots")]
            print(f"Existing columns in 'hero_slots': {columns}")
            
            with engine.connect() as connection:
                # Add image_override_left
                if 'image_override_left' not in columns:
                    print("Adding 'image_override_left'...")
                    connection.execute(text("ALTER TABLE hero_slots ADD COLUMN image_override_left VARCHAR(500)"))
                
                # Add image_override_right
                if 'image_override_right' not in columns:
                    print("Adding 'image_override_right'...")
                    connection.execute(text("ALTER TABLE hero_slots ADD COLUMN image_override_right VARCHAR(500)"))
                    
                connection.commit()
                print("Hero Triptych migration check complete.")
        else:
            print("Table 'hero_slots' does not exist. Skipping hero migration.")

        # =========================================================
        # MIGRATION: Google Place ID (Legacy check)
        # =========================================================
        if inspector.has_table("venues"):
            columns = [c['name'] for c in inspector.get_columns("venues")]
            if 'google_place_id' not in columns:
                print("Adding 'google_place_id' to venues...")
                with engine.connect() as connection:
                    connection.execute(text("ALTER TABLE venues ADD COLUMN google_place_id VARCHAR(255)"))
                    try:
                        connection.execute(text("CREATE UNIQUE INDEX ix_venues_google_place_id ON venues (google_place_id)"))
                    except Exception:
                        pass
                    connection.commit()

        print("All migrations finished successfully.")
            
    except Exception as e:
        print(f"CRITICAL: Migration script failed: {e}")
        # Fail hard so deployment knows something went wrong
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()
