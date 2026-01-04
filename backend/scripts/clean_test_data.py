"""
Script to clean up test data from the production database.
Deletes strictly defined test artifacts to ensure safety.

Usage:
    Run from backend directory:
    python -m scripts.clean_test_data
"""
import sys
import os
from pathlib import Path
from sqlmodel import Session, select, col

# Add backend directory to path so we can import app modules
# This allows running the script from outside the package if needed
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.append(str(backend_dir))

from app.core.database import engine
from app.models.user import User
from app.models.event import Event
from app.models.venue import Venue

def clean_test_data():
    print("🧹 Starting cleanup of test artifacts...")
    
    with Session(engine) as session:
        # 1.1 Find Test Users
        test_emails = ['trusted@test.com', 'newbie@test.com', 'banned@test.com']
        statement = select(User).where(col(User.email).in_(test_emails))
        users = session.exec(statement).all()
        
        user_ids = [user.id for user in users]
        
        # 1.2 Delete Events owned by Test Users FIRST (to avoid FK violations)
        if user_ids:
            statement_events = select(Event).where(col(Event.organizer_id).in_(user_ids))
            user_events = session.exec(statement_events).all()
            
            for event in user_events:
                session.delete(event)
            print(f"🧹 Pre-deleted {len(user_events)} events owned by test users")

        # 1.3 Delete Test Users
        user_count = 0
        for user in users:
            session.delete(user)
            user_count += 1
            
        # 2. Delete REMAINING Test Events (by title)
        statement = select(Event).where(col(Event.title).startswith("[TEST]"))
        events = session.exec(statement).all()
        
        event_count = 0
        for event in events:
            session.delete(event)
            event_count += 1
            
        # 3. Delete Test Venues
        statement = select(Venue).where(col(Venue.name).startswith("[TEST]"))
        venues = session.exec(statement).all()
        
        venue_count = 0
        for venue in venues:
            session.delete(venue)
            venue_count += 1
            
        # Commit all changes
        session.commit()
        
        # Feedback
        print(f"🗑️  Deleted {user_count} Test Users")
        print(f"🗑️  Deleted {event_count} Test Events")
        print(f"🗑️  Deleted {venue_count} Test Venues")
        print("✅ Cleanup complete!")

if __name__ == "__main__":
    clean_test_data()
