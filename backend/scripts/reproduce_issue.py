import sys
import os
from datetime import datetime, timedelta
from uuid import uuid4
from sqlmodel import Session, select, delete

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.database import engine
from app.models.event import Event
from app.models.venue import Venue
from app.services.event_service import upsert_event

def reproduce():
    with Session(engine) as session:
        print("--- Setting up Test Data ---")
        
        # 1. Create two venues close to each other
        venue_a_id = str(uuid4())
        venue_b_id = str(uuid4())
        
        venue_a = Venue(
            id=venue_a_id,
            name="Dornoch Generic",
            address="Dornoch, UK",
            latitude=57.88,
            longitude=-4.03,
            status="VERIFIED"
        )
        venue_b = Venue(
            id=venue_b_id,
            name="Dornoch South Car Park",
            address="Dornoch South, UK",
            latitude=57.8801, # Very close
            longitude=-4.0301,
            status="VERIFIED"
        )
        
        session.add(venue_a)
        session.add(venue_b)
        session.commit()
        
        print(f"Created Venue A: {venue_a.name} ({venue_a.id})")
        print(f"Created Venue B: {venue_b.name} ({venue_b.id})")
        
        # 2. Define Event Data
        title = f"Test Event {uuid4().hex[:8]}"
        date_start = datetime.utcnow() + timedelta(days=10)
        organizer_id = "test_user" # Assuming existence or loose constraint for test? 
        # Note: organizer_id might fail if FK constraint exists and user doesn't.
        # But for reproduction we might get away with it if constraints aren't enforced in sqlite or if we use None.
        # Event model says organizer_id is Optional, but set in upsert.
        # Let's hope for the best or creation might fail. 
        # Actually Event.organizer_id is optional field, but upsert_event requires it as arg.
        # It's used to create Event object.
        # FK is `ForeignKey("users.id", ondelete="SET NULL")`
        # In real DB validation might fail. I'll create a user if needed.
        
        # 3. Import Event at Venue A
        print("\n--- Upserting Event at Venue A ---")
        event_a, created_a = upsert_event(
            session,
            title=title,
            date_start=date_start,
            venue_id=venue_a.id,
            organizer_id=organizer_id,
            fields={"description": "First import"}
        )
        session.add(event_a)
        session.commit()
        print(f"Event A ID: {event_a.id}, Created: {created_a}")
        
        # 4. Import Same Event at Venue B
        print("\n--- Upserting Event at Venue B (Should catch duplicate) ---")
        event_b, created_b = upsert_event(
            session,
            title=title,
            date_start=date_start,
            venue_id=venue_b.id, # Different Venue!
            organizer_id=organizer_id,
            fields={"description": "Second import (more specific)"}
        )
        session.add(event_b)
        session.commit()
        print(f"Event B ID: {event_b.id}, Created: {created_b}")
        
        if event_a.id != event_b.id:
            print("\n❌ DUPLICATE DETECTED! IDs differ.")
        else:
            print("\n✅ MERGED SUCCESS! Events merged.")
            if event_b.venue_id == venue_b.id:
                print("✅ Venue updated to more specific one.")
            else:
                print("⚠️ Venue NOT updated (kept original).")

        # Cleanup
        print("\n--- Cleaning up ---")
        session.delete(event_a)
        if event_a.id != event_b.id:
            session.delete(event_b)
        session.delete(venue_a)
        session.delete(venue_b)
        session.commit()

if __name__ == "__main__":
    try:
        reproduce()
    except Exception as e:
        print(f"Error: {e}")
