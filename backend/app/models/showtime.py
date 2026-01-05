"""
Event Showtime model for multiple showtimes per event (Theatre/Cinema workflow).
Allows a single event to have multiple performance times with optional per-show ticket URLs.
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, String, ForeignKey

if TYPE_CHECKING:
    from .event import Event


class EventShowtime(SQLModel, table=True):
    """
    Represents a single showtime for an event.
    
    Attributes:
        id: Unique showtime identifier (auto-increment)
        event_id: Foreign key to parent Event
        start_time: Showtime start datetime
        end_time: Optional showtime end datetime
        ticket_url: Optional ticket URL specific to this showtime
        notes: Optional notes for this showtime (e.g. "Matinee", "Evening Show")
    """
    __tablename__ = "event_showtimes"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: str = Field(
        sa_column=Column(String, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    start_time: datetime = Field(index=True)
    end_time: Optional[datetime] = Field(default=None)
    ticket_url: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=255)

    # Relationship
    event: "Event" = Relationship(back_populates="showtimes")
