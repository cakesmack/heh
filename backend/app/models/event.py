"""
Event model representing events happening across the Highlands.
Includes geolocation, pricing, and featured status.
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING, List
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship

from .tag import EventTag
from .event_participating_venue import EventParticipatingVenue

if TYPE_CHECKING:
    from .user import User
    from .venue import Venue
    from .checkin import CheckIn
    from .category import Category
    from .tag import Tag
    from .bookmark import Bookmark
    from .organizer import Organizer


class Event(SQLModel, table=True):
    """
    Event model representing a scheduled event.

    Attributes:
        id: Unique event identifier
        title: Event title
        description: Event description
        date_start: Event start date/time
        date_end: Event end date/time
        venue_id: Associated venue
        latitude: Geographic latitude (inherited from venue or custom)
        longitude: Geographic longitude
        geohash: Geohash for spatial indexing
        category: Event category
        price: Ticket price (0 for free events)
        featured: Whether event is featured (paid promotion)
        featured_until: Expiry date for featured status
        organizer_id: User who created the event
        image_url: Optional event image URL
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    __tablename__ = "events"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    title: str = Field(max_length=255, index=True)
    description: Optional[str] = Field(default=None, max_length=5000)

    # Dates
    date_start: datetime = Field(index=True)
    date_end: datetime = Field(index=True)

    # Location
    venue_id: Optional[str] = Field(default=None, foreign_key="venues.id", index=True)
    location_name: Optional[str] = Field(default=None, max_length=255)
    latitude: Optional[float] = Field(default=None, index=True)
    longitude: Optional[float] = Field(default=None, index=True)
    geohash: Optional[str] = Field(default=None, max_length=12, index=True)

    # Classification - Now uses Category table
    category_id: Optional[str] = Field(default=None, foreign_key="categories.id", index=True)
    price: float = Field(default=0.0, ge=0.0)  # 0 = free event

    # Featured status (paid promotion)
    featured: bool = Field(default=False, index=True)
    featured_until: Optional[datetime] = Field(default=None)

    # Moderation
    status: str = Field(default="published", index=True)  # published, pending, rejected, draft

    # Organizer
    organizer_id: str = Field(foreign_key="users.id", index=True)

    # Organizer Profile (Group)
    organizer_profile_id: Optional[str] = Field(default=None, foreign_key="organizers.id", index=True)

    # Recurring Events
    is_recurring: bool = Field(default=False, index=True)
    recurrence_rule: Optional[str] = Field(default=None, max_length=500)  # RRULE string
    parent_event_id: Optional[str] = Field(default=None, index=True)  # UUID of parent series

    # Media
    image_url: Optional[str] = Field(default=None, max_length=500)

    # Phase 2.10 additions
    ticket_url: Optional[str] = Field(default=None, max_length=500)
    age_restriction: Optional[str] = Field(default=None, max_length=50)
    postcode: Optional[str] = Field(default=None, max_length=10)
    address_full: Optional[str] = Field(default=None, max_length=500)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    venue: Optional["Venue"] = Relationship(back_populates="events")
    participating_venues: List["Venue"] = Relationship(
        back_populates="participating_in_events",
        link_model=EventParticipatingVenue
    )
    organizer: "User" = Relationship(back_populates="submitted_events")
    organizer_profile: Optional["Organizer"] = Relationship(back_populates="events")
    check_ins: List["CheckIn"] = Relationship(back_populates="event")
    category_rel: Optional["Category"] = Relationship(back_populates="events")
    tags: List["Tag"] = Relationship(back_populates="events", link_model=EventTag)
    bookmarks: List["Bookmark"] = Relationship(back_populates="event")
