"""
Venue model representing event locations across the Highlands.
Includes geolocation coordinates and categorization.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship

from .event_participating_venue import EventParticipatingVenue

if TYPE_CHECKING:
    from .user import User
    from .event import Event
    from .promotion import Promotion
    from .venue_staff import VenueStaff


class Venue(SQLModel, table=True):
    """
    Venue model representing event locations.

    Attributes:
        id: Unique venue identifier
        name: Venue name
        address: Full address
        latitude: Geographic latitude
        longitude: Geographic longitude
        geohash: Geohash for spatial indexing
        category_id: Foreign key to VenueCategory
        description: Optional venue description
        website: Optional venue website
        phone: Optional contact phone
        image_url: Optional venue image URL
        formatted_address: Optional formatted address for display
        owner_id: User who created/owns this venue
        created_at: Creation timestamp
    """
    __tablename__ = "venues"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    name: str = Field(max_length=255, index=True)
    address: str = Field(max_length=500)

    # Geolocation
    latitude: float = Field(index=True)
    longitude: float = Field(index=True)
    geohash: Optional[str] = Field(default=None, max_length=12, index=True)

    # Classification
    category_id: Optional[str] = Field(default=None, foreign_key="venue_categories.id")

    # Additional info
    description: Optional[str] = Field(default=None, max_length=2000)
    website: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=255)
    opening_hours: Optional[str] = Field(default=None, max_length=500)
    image_url: Optional[str] = Field(default=None, max_length=500)
    formatted_address: Optional[str] = Field(default=None, max_length=500)

    # Phase 2.10 additions
    postcode: Optional[str] = Field(default=None, max_length=10, index=True)
    address_full: Optional[str] = Field(default=None, max_length=500)

    # Amenities (Phase 2.3 Sprint 2)
    is_dog_friendly: bool = Field(default=False)
    has_wheelchair_access: bool = Field(default=False)
    has_parking: bool = Field(default=False)
    serves_food: bool = Field(default=False)
    amenities_notes: Optional[str] = Field(default=None, max_length=500)

    # Ownership
    owner_id: Optional[str] = Field(default=None, foreign_key="users.id")

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    owner: Optional["User"] = Relationship(back_populates="owned_venues")
    category_rel: Optional["VenueCategory"] = Relationship(back_populates="venues")
    events: list["Event"] = Relationship(back_populates="venue")
    participating_in_events: list["Event"] = Relationship(
        back_populates="participating_venues",
        link_model=EventParticipatingVenue
    )
    promotions: list["Promotion"] = Relationship(back_populates="venue")
    staff: list["VenueStaff"] = Relationship(back_populates="venue")
