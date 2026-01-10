"""
Cleanup Script: Remove Ghost ("test") Event
Run this to find and hard-delete the ghost event from database.

Usage: python scripts/cleanup_ghost_events.py
"""

import os
import sys

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, inspect

def get_database_url():
    """Get database URL from environment or use default SQLite."""
    return os.environ.get("DATABASE_URL", "sqlite:///./highland_events.db")

def run_cleanup():
    """Run the ghost event cleanup."""
    database_url = get_database_url()
    
    # Handle Render's postgres:// URL format
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    print("Connecting to database...")
    engine = create_engine(database_url)
    
    with engine.begin() as conn:
        # Step 1: Find the ghost "test" event(s)
        print("\n=== STEP 1: Finding ghost events ===")
        result = conn.execute(text("""
            SELECT id, title, status, date_start, date_end, created_at 
            FROM events 
            WHERE LOWER(title) LIKE '%test%'
            ORDER BY created_at DESC
        """))
        
        ghost_events = result.fetchall()
        
        if not ghost_events:
            print("No events with 'test' in title found.")
        else:
            print(f"Found {len(ghost_events)} potential ghost events:")
            for event in ghost_events:
                print(f"  - ID: {event[0]}")
                print(f"    Title: {event[1]}")
                print(f"    Status: {event[2]}")
                print(f"    Dates: {event[3]} to {event[4]}")
                print(f"    Created: {event[5]}")
                print()
        
        # Step 2: Find any in featured_bookings
        print("\n=== STEP 2: Checking featured_bookings ===")
        try:
            result = conn.execute(text("""
                SELECT fb.id, fb.event_id, e.title, fb.status
                FROM featured_bookings fb
                LEFT JOIN events e ON fb.event_id = e.id
                WHERE LOWER(e.title) LIKE '%test%'
            """))
            featured = result.fetchall()
            
            if featured:
                print(f"Found {len(featured)} featured bookings with 'test' events:")
                for f in featured:
                    print(f"  - Booking ID: {f[0]}, Event ID: {f[1]}, Title: {f[2]}, Status: {f[3]}")
        except Exception as e:
            print(f"Could not check featured_bookings: {e}")
        
        # Step 3: Find any in hero_slots
        print("\n=== STEP 3: Checking hero_slots ===")
        try:
            result = conn.execute(text("""
                SELECT hs.id, hs.event_id, e.title
                FROM hero_slots hs
                LEFT JOIN events e ON hs.event_id::text = e.id::text
                WHERE e.title IS NOT NULL AND LOWER(e.title) LIKE '%test%'
            """))
            hero = result.fetchall()
            
            if hero:
                print(f"Found {len(hero)} hero slots with 'test' events:")
                for h in hero:
                    print(f"  - Slot ID: {h[0]}, Event ID: {h[1]}, Title: {h[2]}")
        except Exception as e:
            print(f"Could not check hero_slots: {e}")
        
        # Step 4: Delete ghost events (PROMPT FOR CONFIRMATION)
        print("\n=== STEP 4: Cleanup ===")
        if ghost_events:
            event_ids = [str(e[0]) for e in ghost_events]
            print(f"Event IDs to delete: {event_ids}")
            
            confirm = input("Do you want to DELETE these events? (yes/no): ")
            
            if confirm.lower() == 'yes':
                # Delete from featured_bookings first
                for eid in event_ids:
                    try:
                        conn.execute(text("DELETE FROM featured_bookings WHERE event_id = :eid"), {"eid": eid})
                        print(f"  Cleaned featured_bookings for event {eid}")
                    except Exception as e:
                        print(f"  Could not clean featured_bookings: {e}")
                
                # Delete from hero_slots
                for eid in event_ids:
                    try:
                        conn.execute(text("DELETE FROM hero_slots WHERE event_id = :eid"), {"eid": eid})
                        print(f"  Cleaned hero_slots for event {eid}")
                    except Exception as e:
                        print(f"  Could not clean hero_slots: {e}")
                
                # Delete the events
                for eid in event_ids:
                    conn.execute(text("DELETE FROM events WHERE id = :eid"), {"eid": eid})
                    print(f"  DELETED event {eid}")
                
                print("\nCleanup complete!")
            else:
                print("Cleanup cancelled.")
        else:
            print("No ghost events to clean up.")
    
    print("\nDone.")

if __name__ == "__main__":
    run_cleanup()
