"""
Event model representing events happening across the Highlands.
Includes geolocation, pricing, and featured status.
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING, List
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, String, ForeignKey

from .tag import EventTag
from .event_participating_venue import EventParticipatingVenue

if TYPE_CHECKING:
    from .user import User
    from .venue import Venue
    from .category import Category
    from .tag import Tag
    from .bookmark import Bookmark
    from .organizer import Organizer
    from .showtime import EventShowtime


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

    # Location - SET NULL so events survive if venue is deleted
    venue_id: Optional[str] = Field(
        default=None,
        sa_column=Column(String, ForeignKey("venues.id", ondelete="SET NULL"), index=True, nullable=True)
    )
    location_name: Optional[str] = Field(default=None, max_length=255)
    latitude: Optional[float] = Field(default=None, index=True)
    longitude: Optional[float] = Field(default=None, index=True)
    geohash: Optional[str] = Field(default=None, max_length=12, index=True)

    # Custom Map Display Point (for multi-venue events)
    map_display_lat: Optional[float] = Field(default=None)
    map_display_lng: Optional[float] = Field(default=None)
    map_display_label: Optional[str] = Field(default=None, max_length=255)

    # Classification - SET NULL so events survive if category is deleted
    category_id: Optional[str] = Field(
        default=None,
        sa_column=Column(String, ForeignKey("categories.id", ondelete="SET NULL"), index=True, nullable=True)
    )
    price: float = Field(default=0.0, ge=0.0)  # Legacy - keeping for backward compatibility
    price_display: Optional[str] = Field(default=None, max_length=100)  # User-friendly price text
    min_price: float = Field(default=0.0, ge=0.0)  # For search filtering (parsed from price_display)

    # Featured status (paid promotion)
    featured: bool = Field(default=False, index=True)
    featured_until: Optional[datetime] = Field(default=None)

    # Moderation
    status: str = Field(default="published", index=True)  # published, pending, rejected, draft
    moderation_reason: Optional[str] = Field(default=None, max_length=255)  # Why it was flagged

    # Organizer - SET NULL so events survive if user is deleted
    organizer_id: Optional[str] = Field(
        default=None,
        sa_column=Column(String, ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    )

    # Organizer Profile (Group) - SET NULL so events survive if group is deleted
    organizer_profile_id: Optional[str] = Field(
        default=None,
        sa_column=Column(String, ForeignKey("organizers.id", ondelete="SET NULL"), index=True, nullable=True)
    )

    # Recurring Events
    is_recurring: bool = Field(default=False, index=True)
    recurrence_rule: Optional[str] = Field(default=None, max_length=500)  # RRULE string
    parent_event_id: Optional[str] = Field(default=None, index=True)  # UUID of parent series
    recurrence_group_id: Optional[str] = Field(default=None, index=True)  # Shared UUID for all events in a recurring series

    # Media
    image_url: Optional[str] = Field(default=None, max_length=500)

    # Phase 2.10 additions
    ticket_url: Optional[str] = Field(default=None, max_length=500)
    website_url: Optional[str] = Field(default=None, max_length=500)  # Separate event website link
    is_all_day: bool = Field(default=False)  # True if event spans entire day (no specific times)
    age_restriction: Optional[str] = Field(default=None, max_length=50)  # Legacy - keeping for compatibility
    min_age: Optional[int] = Field(default=None)  # Numeric minimum age (0 = all ages, None = not specified)
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
    category_rel: Optional["Category"] = Relationship(back_populates="events")
    tags: List["Tag"] = Relationship(back_populates="events", link_model=EventTag)
    bookmarks: List["Bookmark"] = Relationship(back_populates="event")
    showtimes: List["EventShowtime"] = Relationship(back_populates="event")
