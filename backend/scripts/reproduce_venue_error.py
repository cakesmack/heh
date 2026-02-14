import sys
import os
from datetime import datetime, timedelta
from uuid import uuid4
from sqlmodel import Session, select, SQLModel

# Set env vars BEFORE importing app
os.environ["DATABASE_URL"] = "sqlite:///./reproduce_venue.db"
os.environ["SECRET_KEY"] = "test_secret"

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.database import engine
from app.models.event import Event
from app.models.venue import Venue
from app.models.user import User
from app.api.admin_import import import_single_event, SingleEventImportRequest

def reproduce():
    # Init DB
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        # Create Admin User
        user = User(id=uuid4().hex, email="admin@test.com", username="admin", is_admin=True)
        session.add(user)
        session.commit()
        
        # Define a Venue ID that DOES NOT exist in DB
        missing_venue_id = "cf033266e3e14fafb845115da821dc34"
        
        print(f"\n--- Testing Import with Missing Venue ID: {missing_venue_id} ---")
        
        req = SingleEventImportRequest(
            title="Test Event - Venue Missing",
            description="Testing venue creation",
            date_start=datetime.now(),
            image_url="http://example.com/image.jpg",
            ticket_url="http://example.com",
            price_display="Free",
            min_price=0,
            min_age=18,
            venue_id=missing_venue_id, # This ID is missing!
            location_name="Upstairs Inverness",
            category_id=uuid4().hex,
            address="123 Any St",
            latitude=57.0,
            longitude=-4.0
        )
        
        try:
            # This should FAIL with 400 (current logic) or SUCCEED (desired logic)
            response = import_single_event(req, current_user=user, session=session)
            print("✅ SUCCESS! Event imported.")
            if response.get("created"):
                ev = session.get(Event, response["event_id"])
                print(f"   Event Venue ID: {ev.venue_id}")
                
                # Check if venue was created
                v = session.get(Venue, ev.venue_id)
                if v:
                    print(f"   ✅ Venue Created/Found: {v.name} ({v.id})")
                else:
                    print("   ❌ Venue STILL MISSING in DB (FK Violation waiting to happen?)")
                    
        except Exception as e:
            print(f"❌ FAILED: {e}")

if __name__ == "__main__":
    reproduce()
