from datetime import datetime
from sqlmodel import Field, SQLModel
from sqlalchemy import Column, String, ForeignKey

class EventParticipatingVenue(SQLModel, table=True):
    """
    Link table for events having multiple participating venues (e.g., Festivals, Crawls).
    """
    __tablename__ = "event_participating_venues"

    event_id: str = Field(
        sa_column=Column(String, ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    )
    venue_id: str = Field(foreign_key="venues.id", primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
