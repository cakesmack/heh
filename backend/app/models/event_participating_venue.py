from datetime import datetime
from sqlmodel import Field, SQLModel

class EventParticipatingVenue(SQLModel, table=True):
    """
    Link table for events having multiple participating venues (e.g., Festivals, Crawls).
    """
    __tablename__ = "event_participating_venues"

    event_id: str = Field(foreign_key="events.id", primary_key=True)
    venue_id: str = Field(foreign_key="venues.id", primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
