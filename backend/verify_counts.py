from datetime import datetime, timedelta
from sqlmodel import Session, select, func
from app.core.database import engine
from app.models.organizer import Organizer
from app.models.event import Event
from app.core.utils import normalize_uuid

def verify_unique_counts():
    session = Session(engine)
    try:
        # 1. Create a test organizer
        test_org = Organizer(
            name="Count Test Group",
            slug="count-test-group",
            user_id="00000000-0000-0000-0000-000000000000" # System/Admin
        )
        session.add(test_org)
        session.commit()
        session.refresh(test_org)
        org_id = test_org.id
        print(f"Created test organizer: {org_id}")

        # 2. Create events
        # A. Two events with same title (Recurring)
        e1 = Event(
            title="Reindeer Encounter",
            organizer_profile_id=org_id,
            date_start=datetime.utcnow() + timedelta(days=1),
            date_end=datetime.utcnow() + timedelta(days=1, hours=2),
            status="published",
            location_name="Test Location",
            user_id="00000000-0000-0000-0000-000000000000"
        )
        e2 = Event(
            title="Reindeer Encounter",
            organizer_profile_id=org_id,
            date_start=datetime.utcnow() + timedelta(days=2),
            date_end=datetime.utcnow() + timedelta(days=2, hours=2),
            status="published",
            location_name="Test Location",
            user_id="00000000-0000-0000-0000-000000000000"
        )
        # B. One event with different title
        e3 = Event(
            title="Santa Workshop",
            organizer_profile_id=org_id,
            date_start=datetime.utcnow() + timedelta(days=3),
            date_end=datetime.utcnow() + timedelta(days=3, hours=2),
            status="published",
            location_name="Test Location",
            user_id="00000000-0000-0000-0000-000000000000"
        )
        # C. One event that is PAST (should not be counted)
        e4 = Event(
            title="Halloween Party",
            organizer_profile_id=org_id,
            date_start=datetime.utcnow() - timedelta(days=10),
            date_end=datetime.utcnow() - timedelta(days=10, hours=2),
            status="published",
            location_name="Test Location",
            user_id="00000000-0000-0000-0000-000000000000"
        )
        # D. One event that is DRAFT (should not be counted)
        e5 = Event(
            title="New Year Eve",
            organizer_profile_id=org_id,
            date_start=datetime.utcnow() + timedelta(days=30),
            date_end=datetime.utcnow() + timedelta(days=30, hours=2),
            status="draft",
            location_name="Test Location",
            user_id="00000000-0000-0000-0000-000000000000"
        )
        
        session.add_all([e1, e2, e3, e4, e5])
        session.commit()
        print("Created 5 test events (2 same title, 1 past, 1 draft, 1 unique)")

        # 3. Verify count using the logic from organizers.py
        # Base query
        query = (
            select(Organizer, func.count(func.distinct(Event.title)).label("computed_count"))
            .outerjoin(
                Event,
                (Event.organizer_profile_id == Organizer.id) &
                (Event.date_end >= datetime.utcnow()) &
                (Event.status == "published")
            )
            .where(Organizer.id == org_id)
            .group_by(Organizer.id)
        )
        
        result = session.exec(query).first()
        org_obj, count = result
        print(f"Computed Count for organizer: {count}")
        
        # EXPECTED: 2 (Reindeer Encounter + Santa Workshop)
    except Exception as e:
        import traceback
        print("ERROR IN VERIFICATION:")
        traceback.print_exc()

    finally:
        # Cleanup
        print("Cleaning up...")
        if 'org_id' in locals():
            from sqlalchemy import delete
            session.exec(delete(Event).where(Event.organizer_profile_id == org_id))
            session.exec(delete(Organizer).where(Organizer.id == org_id))
            session.commit()
        session.close()

if __name__ == "__main__":
    verify_unique_counts()
