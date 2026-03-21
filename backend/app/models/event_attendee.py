from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from typing import TYPE_CHECKING
from app.core.utils import normalize_uuid
from uuid import uuid4

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.event import Event

class EventAttendee(SQLModel, table=True):
    """
    Junction table for tracking high-intent RSVP attendance.
    Links Users and Events for the purpose of marking "I'm Going".
    """
    __tablename__ = "event_attendees"

    id: str = Field(default_factory=lambda: normalize_uuid(uuid4()), primary_key=True, max_length=36)
    user_id: str = Field(foreign_key="users.id", max_length=36, index=True)
    event_id: str = Field(foreign_key="events.id", max_length=36, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: "User" = Relationship(back_populates="attended_events")
    event: "Event" = Relationship(back_populates="attendees")
