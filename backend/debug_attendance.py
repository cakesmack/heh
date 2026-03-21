from sqlalchemy import create_engine, text, select
from dotenv import load_dotenv
import os
import sys

# Add backend to path
sys.path.append('c:/Users/Craig/Desktop/projects/antigrav/heh/highland_events_app/backend')

from app.core.utils import normalize_uuid
from app.models.event_attendee import EventAttendee
from app.models.user import User
from app.models.event import Event
from sqlmodel import Session

load_dotenv('c:/Users/Craig/Desktop/projects/antigrav/heh/highland_events_app/backend/.env')
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)

with Session(engine) as session:
    # 1. List all records in event_attendees
    print("EVENT_ATTENDEES RECORDS:")
    attendees = session.exec(select(EventAttendee)).all()
    for a in attendees:
        print(f"  ID: {a.id}, USER_ID: {a.user_id}, EVENT_ID: {a.event_id}")
        
    # 2. Check current user (assume first one for test)
    user = session.exec(select(User).limit(1)).first()
    if user:
        print(f"\nTEST USER: ID={user.id}, email={user.email}")
        print(f"  Normalized User ID: {normalize_uuid(user.id)}")
        
        # Check if this user has any attendance
        match = session.exec(select(EventAttendee).where(EventAttendee.user_id == normalize_uuid(user.id))).all()
        print(f"  Matches by normalized user_id: {len(match)}")
        for m in match:
            print(f"    Target Event ID in DB: {m.event_id}")
            # Compare to an actual event
            event = session.get(Event, m.event_id)
            if event:
                print(f"    Found Event: {event.id} ({event.title})")
                print(f"    Comparison (Direct): {m.event_id == event.id}")
                print(f"    Comparison (Normalized): {normalize_uuid(m.event_id) == normalize_uuid(event.id)}")
            else:
                print(f"    Event {m.event_id} NOT FOUND in events table!")

