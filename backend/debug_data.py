from sqlmodel import Session, select
from app.core.database import engine
from app.models.venue import Venue
from app.models.event import Event

def check_data():
    with Session(engine) as session:
        # 1. Find venues in Inverness
        statement = select(Venue).where(Venue.address.ilike("%Inverness%")).limit(5)
        venues = session.exec(statement).all()
        
        print(f"Found {len(venues)} venues matching 'Inverness':")
        for v in venues:
            print(f"  Venue: {v.name}")
            print(f"    ID: {v.id}")
            print(f"    Address: {v.address}")
            print(f"    Coords: {v.latitude}, {v.longitude}")
            
            # Check events for this venue
            events = session.exec(select(Event).where(Event.venue_id == v.id)).all()
            print(f"    Events: {len(events)}")
            for e in events:
                print(f"      Event: {e.title}")
                print(f"      Event Coords: {e.latitude}, {e.longitude}")

if __name__ == "__main__":
    check_data()
