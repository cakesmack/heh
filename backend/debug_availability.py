
from datetime import date, timedelta
from app.models.featured_booking import SlotType, FeaturedBooking, BookingStatus
from app.services.featured import check_availability
from sqlmodel import Session, create_engine, SQLModel
from app.core.config import settings

# Setup in-memory DB
engine = create_engine("sqlite:///:memory:")
SQLModel.metadata.create_all(engine)

def test_availability():
    with Session(engine) as session:
        print("--- STARTING AVAILABILITY DEBUG ---")
        
        # 1. Test Empty DB
        start = date.today()
        end = start + timedelta(days=2)
        print(f"\n1. Checking Empty DB for {SlotType.HERO_HOME} ({start} to {end})")
        res = check_availability(session, SlotType.HERO_HOME, start, end)
        print(f"Result: {res['available']} (Remaining: {res.get('slots_remaining')})")
        
        if not res['available']:
            print("❌ FAILED: Should be available on empty DB")
        
        # 2. Insert 1 Active Booking
        b1 = FeaturedBooking(
            event_id="evt_1",
            slot_type=SlotType.HERO_HOME,
            start_date=start,
            end_date=end,
            status=BookingStatus.ACTIVE,
            amount_paid=1000
        )
        session.add(b1)
        session.commit()
        print(f"\n2. Inserted 1 booking. Checking availability again...")
        
        res = check_availability(session, SlotType.HERO_HOME, start, end)
        print(f"Result: {res['available']} (Remaining: {res.get('slots_remaining')})")
        
        # Validating limit > 1
        rem = list(res['slots_remaining'].values())[0]
        if rem < 3:
             print(f"❌ FAILED: Remaining slots {rem} is too low! Expected ~4.")
        else:
             print(f"✅ PASS: Remaining slots {rem} looks correct.")

        # 3. Simulate "Limit 1" Bug
        # Insert 4 more to fill it up (total 5)
        for i in range(4):
            session.add(FeaturedBooking(
                event_id=f"evt_{i+2}",
                slot_type=SlotType.HERO_HOME,
                start_date=start,
                end_date=end,
                status=BookingStatus.ACTIVE,
                amount_paid=1000
            ))
        session.commit()
        
        print(f"\n3. Inserted 4 more (Total 5). Checking availability...")
        res = check_availability(session, SlotType.HERO_HOME, start, end)
        print(f"Result: {res['available']} (Remaining: {res.get('slots_remaining')})")
        
        if res['available']:
             print("❌ FAILED: Should be FULL.")
        else:
             print("✅ PASS: Correctly reported as full.")

if __name__ == "__main__":
    test_availability()
