"""
Legacy migrations extracted from backend/app/main.py.
These were originally run on startup using app.lifespan.
Saved here for reference.
"""
from sqlalchemy import text
from app.core.database import engine

def run_legacy_migrations():
    print("Running legacy migrations...")
    with engine.connect() as conn:
        # Add venue contact and social media fields if they don't exist
        conn.execute(text("""
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='email') THEN
                    ALTER TABLE venues ADD COLUMN email VARCHAR(255);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='opening_hours') THEN
                    ALTER TABLE venues ADD COLUMN opening_hours VARCHAR(500);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='social_facebook') THEN
                    ALTER TABLE venues ADD COLUMN social_facebook VARCHAR(255);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='social_instagram') THEN
                    ALTER TABLE venues ADD COLUMN social_instagram VARCHAR(255);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='social_x') THEN
                    ALTER TABLE venues ADD COLUMN social_x VARCHAR(255);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='social_linkedin') THEN
                    ALTER TABLE venues ADD COLUMN social_linkedin VARCHAR(255);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='social_tiktok') THEN
                    ALTER TABLE venues ADD COLUMN social_tiktok VARCHAR(255);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='website_url') THEN
                    ALTER TABLE venues ADD COLUMN website_url VARCHAR(255);
                END IF;
                -- Add moderation_reason to events table
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='moderation_reason') THEN
                    ALTER TABLE events ADD COLUMN moderation_reason VARCHAR(255);
                END IF;
                
                -- Add MAGAZINE_CAROUSEL to slottype enum if it doesn't exist
                IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MAGAZINE_CAROUSEL' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'slottype')) THEN
                    ALTER TYPE slottype ADD VALUE IF NOT EXISTS 'MAGAZINE_CAROUSEL';
                END IF;
                
                -- Organizer profile enhancements (Part 2 upgrade)
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizers' AND column_name='cover_image_url') THEN
                    ALTER TABLE organizers ADD COLUMN cover_image_url VARCHAR(500);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizers' AND column_name='city') THEN
                    ALTER TABLE organizers ADD COLUMN city VARCHAR(100);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizers' AND column_name='social_facebook') THEN
                    ALTER TABLE organizers ADD COLUMN social_facebook VARCHAR(500);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizers' AND column_name='social_instagram') THEN
                    ALTER TABLE organizers ADD COLUMN social_instagram VARCHAR(500);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizers' AND column_name='social_website') THEN
                    ALTER TABLE organizers ADD COLUMN social_website VARCHAR(500);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizers' AND column_name='public_email') THEN
                    ALTER TABLE organizers ADD COLUMN public_email VARCHAR(255);
                END IF;
                
                -- Personalization Engine: notification preferences for users
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='receive_interest_notifications') THEN
                    ALTER TABLE users ADD COLUMN receive_interest_notifications BOOLEAN DEFAULT TRUE;
                END IF;
                
                -- Recurring Event Group ID for linking recurring series
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='recurrence_group_id') THEN
                    ALTER TABLE events ADD COLUMN recurrence_group_id VARCHAR(255);
                    CREATE INDEX IF NOT EXISTS ix_events_recurrence_group_id ON events(recurrence_group_id);
                END IF;

                -- Venue Status Migration (Production Recovery)
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='status') THEN
                    ALTER TABLE venues ADD COLUMN status VARCHAR(50) DEFAULT 'UNVERIFIED';
                    -- Backfill existing as verified
                    UPDATE venues SET status = 'VERIFIED' WHERE status IS NULL OR status = 'unverified' OR status = 'verified';
                END IF;
                
                -- Normalize existing status to uppercase if column exists
                UPDATE venues SET status = upper(status);

                -- Add Map Display Fields for Multi-Venue Events
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='map_display_lat') THEN
                    ALTER TABLE events ADD COLUMN map_display_lat FLOAT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='map_display_lng') THEN
                    ALTER TABLE events ADD COLUMN map_display_lng FLOAT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='map_display_label') THEN
                    ALTER TABLE events ADD COLUMN map_display_label VARCHAR(255);
                END IF;
            END $$;
        """))
        conn.commit()

        # --- Robust Google Place ID Fix (Production Recovery) ---
        # Using Inspector to check columns reliably
        from sqlalchemy import inspect
        inspector = inspect(engine)
        
        if inspector.has_table("venues"):
            columns = [c['name'] for c in inspector.get_columns("venues")]
            if 'google_place_id' not in columns:
                print("Column 'google_place_id' missing in venues. Adding it now...")
                conn.execute(text("ALTER TABLE venues ADD COLUMN google_place_id VARCHAR(255)"))
                try:
                    conn.execute(text("CREATE UNIQUE INDEX ix_venues_google_place_id ON venues (google_place_id)"))
                except Exception as ie:
                    print(f"Index creation warning: {ie}")
                conn.commit()
                print("Column 'google_place_id' added successfully.")
            else:
                print("Column 'google_place_id' verified existing.")
        # -------------------------------------------------------

if __name__ == "__main__":
    run_legacy_migrations()
