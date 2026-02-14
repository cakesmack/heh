import sys
import os

# Set env vars BEFORE importing app
os.environ["DATABASE_URL"] = "sqlite:///./reproduce_issue.db"
os.environ["SECRET_KEY"] = "dummy_secret_key_for_testing"

from datetime import datetime, timedelta
from uuid import uuid4
from sqlmodel import Session, select, delete, SQLModel

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.database import engine
from app.models.event import Event
from app.models.venue import Venue
from app.models.user import User
from app.models.organizer import Organizer
from app.models.category import Category
from app.services.event_service import upsert_event

def reproduce():
    # Initialize DB
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        print("--- Setting up Test Data ---")
        
        # 0. Create a User (Organizer)
        user_id = str(uuid4()).replace("-", "")
        # Check if user exists or create new
        user = User(
            id=user_id,
            email=f"test_{user_id[:8]}@example.com",
            username=f"test_{user_id[:8]}",
            password_hash="dummy"
        )
        session.add(user)
        session.commit()
        print(f"Created User: {user.username} ({user.id})")
        
        organizer_id = user.id
        
        # 1. Create two venues close to each other
        venue_a_id = str(uuid4())
        venue_b_id = str(uuid4())
        
        venue_a = Venue(
            id=venue_a_id,
            name="Dornoch Generic",
            address="Dornoch, UK",
            latitude=57.88,
            longitude=-4.03,
            status="VERIFIED",
            owner_id=user.id
        )
        venue_b = Venue(
            id=venue_b_id,
            name="Dornoch South Car Park",
            address="Dornoch South, UK",
            latitude=57.8801, # Very close
            longitude=-4.0301,
            status="VERIFIED",
            owner_id=user.id
        )
        
        session.add(venue_a)
        session.add(venue_b)
        session.commit()
        
        print(f"Created Venue A: {venue_a.name} ({venue_a.id})")
        print(f"Created Venue B: {venue_b.name} ({venue_b.id})")
        
        # 2. Define Event Data
        title = f"Test Event {uuid4().hex[:8]}"
        date_start = datetime.utcnow() + timedelta(days=10)
        
        # 3. Import Event at Venue A
        print("\n--- Upserting Event at Venue A ---")
        try:
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
        except Exception as e:
            print(f"FAILED to upsert A: {e}")
            import traceback
            traceback.print_exc()
            try:
                session.delete(user)
                session.delete(venue_a)
                session.delete(venue_b)
                session.commit()
            except:
                pass
            return
        
        # 4. Import Same Event with "Copy of" prefix
        print("\n--- Upserting Event with 'Copy of' prefix (Simulating API fix) ---")
        
        raw_title = f"Copy of {title}"
        
        # Simulate API Logic (stripping prefix)
        clean_title = raw_title
        if clean_title.lower().startswith("copy of "):
             clean_title = clean_title[8:]
             print(f"DEBUG: Stripped prefix. '{raw_title}' -> '{clean_title}'")
        
        try:
            event_b, created_b = upsert_event(
                session,
                title=clean_title, # Pass CLEAN title
                date_start=date_start,
                venue_id=venue_a.id, # Same Venue
                organizer_id= organizer_id,
                fields={"description": "Second import (should merge)"}
            )
            session.add(event_b)
            session.commit()
            print(f"Event B ID: {event_b.id}, Created: {created_b}")
        except Exception as e:
            print(f"FAILED to upsert B: {e}")
            import traceback
            traceback.print_exc()
            return

        if event_a.id != event_b.id:
            print("\nDUPLICATE DETECTED! IDs differ.")
        else:
            print("\nMERGED SUCCESS! Events merged.")
            if event_b.venue_id == venue_b.id:
                print("Venue updated to more specific one.")
            else:
                print("Venue NOT updated (kept original).")

        # Cleanup
        print("\n--- Cleaning up ---")
        session.delete(event_a)
        if event_a.id != event_b.id:
            session.delete(event_b)
        session.delete(venue_a)
        session.delete(venue_b)
        session.delete(user)
        session.commit()

if __name__ == "__main__":
    try:
        reproduce()
    except Exception as e:
        print(f"Error: {e}")
