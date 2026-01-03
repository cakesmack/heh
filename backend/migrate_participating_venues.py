from sqlmodel import Session, text, SQLModel
from app.core.database import engine
# Import all models to ensure they are registered
from app.models.user import User
from app.models.venue import Venue
from app.models.event import Event
from app.models.event_participating_venue import EventParticipatingVenue

def migrate():
    print("Migrating event_participating_venues table...")
    try:
        # Create table using SQLModel metadata
        SQLModel.metadata.create_all(engine)
        print("Migration complete - checked/created all tables.")
    except Exception as e:
        print(f"Migration failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    migrate()
