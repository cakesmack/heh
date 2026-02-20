from datetime import datetime, timedelta
from sqlmodel import Session, select, func
from app.core.database import engine
from app.models.organizer import Organizer
from app.models.event import Event
import traceback

def test():
    session = Session(engine)
    try:
        # Just use one existing organizer or create one
        org = session.exec(select(Organizer)).first()
        if not org:
            print("No organizers found, skipping test")
            return
            
        print(f"Testing for organizer: {org.name} ({org.id})")
        
        q = select(func.count(func.distinct(Event.title))).where(
            Event.organizer_profile_id == org.id,
            Event.status == "published"
        )
        count = session.exec(q).one()
        print(f"Result count: {count}")
        print("SUCCESS")
        
    except Exception:
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    test()
