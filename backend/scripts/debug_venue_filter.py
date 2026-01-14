
import sys
import os
from datetime import datetime

# Set dummy environment variables to satisfy Settings validation
os.environ["SECRET_KEY"] = "dummy_secret_key_for_debug_script"
if "DATABASE_URL" not in os.environ:
    # Try to find the local SQLite database
    db_path = os.path.join(os.path.dirname(__file__), '..', 'highland_events.db')
    if os.path.exists(db_path):
        os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    else:
        # Fallback or assume it's set in the environment (e.g. Render)
        # If running locally without .env, we might default to a local sqlite path relative to CWD
        os.environ["DATABASE_URL"] = "sqlite:///./highland_events.db"

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from sqlmodel import Session, select, func
from app.core.database import engine
from app.models.event import Event
from app.models.venue import Venue

def debug_venue_filter():
    with Session(engine) as session:
        # Get 5 venues that have at least one event
        venues = session.exec(select(Venue).limit(20)).all()
        
        print(f"Checking {len(venues)} venues...")
        now = datetime.utcnow()
        
        for venue in venues:
            # Check if venue has ANY events
            total_events = session.exec(select(func.count()).where(Event.venue_id == venue.id)).one()
            if total_events == 0:
                continue
                
            print(f"\nVenue: {venue.name} (ID: {venue.id})")
            print(f"  Total Events: {total_events}")
            
            # Count Parents (parent_event_id is None)
            parents = session.exec(select(func.count()).where(Event.venue_id == venue.id).where(Event.parent_event_id == None)).one()
            print(f"  Parent Events (Main): {parents}")
            
            # Count Future Events
            future = session.exec(select(func.count()).where(Event.venue_id == venue.id).where(Event.date_end >= now)).one()
            print(f"  Future Events: {future}")
            
            # Count Future Parents
            future_parents = session.exec(select(func.count()).where(Event.venue_id == venue.id).where(Event.parent_event_id == None).where(Event.date_end >= now)).one()
            print(f"  Future Parents (Shown in Default View): {future_parents}")
            
            # Count Future Children
            future_children = session.exec(select(func.count()).where(Event.venue_id == venue.id).where(Event.parent_event_id != None).where(Event.date_end >= now)).one()
            print(f"  Future Children (Hidden): {future_children}")

            if future > 0 and future_parents == 0:
                print("  !!! PROBLEM DETECTED: Has future events, but filter hides all of them (Parent is past, Children are hidden).")

if __name__ == "__main__":
    debug_venue_filter()
