import sys
import os

# Add backend to path
sys.path.append(os.path.abspath("backend"))

from sqlmodel import Session, select, func
from app.core.database import engine
from app.models.venue import Venue, VenueStatus
from app.models.event import Event

def debug_venues():
    try:
        with Session(engine) as session:
            print("--- Venue Status Debug ---")
            # 1. Count all unverified venues
            unverified_count = session.exec(select(func.count(Venue.id)).where(Venue.status == VenueStatus.UNVERIFIED)).one()
            print(f"Total Venues with status='UNVERIFIED': {unverified_count}")
            
            # 2. List distinct statuses
            statuses = session.exec(select(Venue.status).distinct()).all()
            print(f"Distinct Venue Statuses in DB: {statuses}")
            
            # 3. List ALL venues that are NOT Verified and have events
            # This helps see if they are 'DRAFT' or something else
            print("\n--- Venues with Events (Non-Verified) ---")
            query = (
                select(Venue.name, Venue.status, func.count(Event.id).label("event_count"))
                .join(Event, Event.venue_id == Venue.id)
                .where(Venue.status != "VERIFIED") # Check all non-verified
                .group_by(Venue.id)
                .having(func.count(Event.id) > 0)
                .order_by(func.count(Event.id).desc())
            )
            results = session.exec(query).all()
            print(f"Found {len(results)} non-verified venues with events:")
            for name, status, count in results:
                print(f"- {name} (Status: {status}): {count} events")
                
            print("\n--- Missing Location Logic Check ---")
            # 4. Check "Missing Location" logic
            missing_loc_events = session.exec(
                select(Event.id, Event.title, Event.latitude, Event.venue_id)
                .where((Event.latitude == None) | (Event.latitude == 0))
            ).all()
            print(f"Total Events with Lat=None/0: {len(missing_loc_events)}")
            
            missing_loc_no_venue = [e for e in missing_loc_events if e.venue_id is None]
            print(f"Events with Lat=None/0 AND Venue=None: {len(missing_loc_no_venue)}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_venues()
