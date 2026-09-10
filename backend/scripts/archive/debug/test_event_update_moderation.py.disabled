import sys
sys.path.append('c:/Users/Craig/Desktop/projects/antigrav/heh/highland_events_app/backend')

from sqlmodel import Session, select
from app.core.database import engine
from app.api.events import update_event
from app.models.event import Event
from app.models.user import User
from app.models.venue import Venue, VenueStatus
from app.models.featured_booking import FeaturedBooking, BookingStatus, SlotType
from app.schemas.event import EventUpdate
from fastapi import BackgroundTasks
import datetime

def test_run():
    print("Testing event update moderation logic...")
    bg_tasks = BackgroundTasks()

    with Session(engine) as session:
        # Find a normal user (non-admin, non-trusted)
        normal_user = session.exec(select(User).where(User.is_admin == False).where(User.is_trusted_organizer == False)).first()
        if not normal_user:
            print("ERROR: No normal user found in DB to run tests.")
            return

        # Find or create a test event owned by this user
        test_event = session.exec(select(Event).where(Event.organizer_id == normal_user.id)).first()
        if not test_event:
            print("Creating test event for user...")
            test_event = Event(
                title="Temp Test Event",
                description="Test event description",
                date_start=datetime.datetime.utcnow(),
                date_end=datetime.datetime.utcnow() + datetime.timedelta(hours=2),
                status="published",
                organizer_id=normal_user.id
            )
            session.add(test_event)
            session.commit()
            session.refresh(test_event)

        # Force state to published for the test event
        test_event.status = "published"
        test_event.venue_id = None
        session.add(test_event)
        
        # Clean up any existing featured bookings for this test event
        existing_bookings = session.exec(select(FeaturedBooking).where(FeaturedBooking.event_id == test_event.id)).all()
        for b in existing_bookings:
            session.delete(b)
        session.commit()
        session.refresh(test_event)

        event_id = test_event.id
        print(f"Using Event ID: {event_id}, Status: {test_event.status}")

        # Case 1: Revert to pending (untrusted user, unverified venue, no promotion)
        print("\n--- CASE 1: Expect Revert to Pending ---")
        update_data = EventUpdate(title="Updated Title Case 1")
        # Run in a sub-transaction so we can rollback or check state
        import asyncio
        async def run_update():
            await update_event(
                event_id=event_id,
                event_data=update_data,
                current_user=normal_user,
                session=session,
                background_tasks=bg_tasks
            )
        
        asyncio.run(run_update())
        print(f"Status after update: {test_event.status}")
        assert test_event.status == "pending", f"Expected pending but got {test_event.status}"
        print("CASE 1 passed successfully!")

        # Reset to published
        test_event.status = "published"
        session.add(test_event)
        session.commit()

        # Case 2: Bypass moderation via verified venue
        print("\n--- CASE 2: Expect Bypass via Verified Venue ---")
        # Find or create a verified venue
        verified_venue = session.exec(select(Venue).where(Venue.status == VenueStatus.VERIFIED)).first()
        if not verified_venue:
            print("Creating verified venue...")
            verified_venue = Venue(
                name="Test Verified Venue",
                address="123 Street",
                status=VenueStatus.VERIFIED
            )
            session.add(verified_venue)
            session.commit()
            session.refresh(verified_venue)
        
        test_event.venue_id = verified_venue.id
        session.add(test_event)
        session.commit()

        update_data = EventUpdate(title="Updated Title Case 2")
        asyncio.run(run_update())
        print(f"Status after update: {test_event.status}")
        assert test_event.status == "published", f"Expected published but got {test_event.status}"
        print("CASE 2 passed successfully!")

        # Reset venue to None and status to published
        test_event.status = "published"
        test_event.venue_id = None
        session.add(test_event)
        session.commit()

        # Case 3: Bypass moderation via paid promotion
        print("\n--- CASE 3: Expect Bypass via Active Paid Promotion ---")
        # Create an active FeaturedBooking
        booking = FeaturedBooking(
            event_id=event_id,
            organizer_id=normal_user.id,
            slot_type=SlotType.PREMIUM,
            start_date=datetime.date.today(),
            end_date=datetime.date.today(),
            status=BookingStatus.ACTIVE
        )
        session.add(booking)
        session.commit()

        update_data = EventUpdate(title="Updated Title Case 3")
        asyncio.run(run_update())
        print(f"Status after update: {test_event.status}")
        assert test_event.status == "published", f"Expected published but got {test_event.status}"
        print("CASE 3 passed successfully!")

        # Clean up
        session.delete(booking)
        session.commit()

if __name__ == "__main__":
    test_run()
