"""
Check-in model for tracking user attendance at events.
Validates location and time for verified attendance.
"""
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .user import User
    from .event import Event


class CheckIn(SQLModel, table=True):
    """
    Check-in model representing a user's verified attendance at an event.

    Attributes:
        id: Unique check-in identifier
        user_id: User who checked in
        event_id: Event checked into
        timestamp: When the check-in occurred
        latitude: User's latitude at check-in time
        longitude: User's longitude at check-in time
        is_first_at_venue: Whether this was user's first check-in at this venue
        is_night_checkin: Whether this was an evening check-in (after 6pm)
    """
    __tablename__ = "checkins"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    user_id: str = Field(
        foreign_key="users.id", 
        index=True,
        sa_column_kwargs={"ondelete": "CASCADE"}
    )
    event_id: str = Field(
        foreign_key="events.id", 
        index=True,
        sa_column_kwargs={"ondelete": "CASCADE"}
    )

    # Timing
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)

    # Location validation data
    latitude: float
    longitude: float

    # Special check-in flags
    is_first_at_venue: bool = Field(default=False)
    is_night_checkin: bool = Field(default=False)  # After 6pm

    # Relationships
    user: "User" = Relationship(back_populates="check_ins")
    event: "Event" = Relationship(back_populates="check_ins")
