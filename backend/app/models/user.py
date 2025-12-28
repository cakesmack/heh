"""
User model for authentication and user profiles.
Tracks XP, level, and relationships with events, check-ins, and badges.
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .checkin import CheckIn
    from .event import Event
    from .venue import Venue
    from .payment import Payment
    from .bookmark import Bookmark
    from .organizer import Organizer
    from .follow import Follow
    from .group_member import GroupMember
    from .venue_staff import VenueStaff
    from .user_preferences import UserPreferences
    from .featured_booking import FeaturedBooking


class User(SQLModel, table=True):
    """
    User model representing registered users.

    Attributes:
        id: Unique user identifier
        email: User's email address (unique)
        password_hash: Hashed password
        is_admin: Admin flag for moderation access
        created_at: Account creation timestamp
    """
    __tablename__ = "users"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    email: str = Field(unique=True, index=True, max_length=255)
    password_hash: Optional[str] = Field(default=None, max_length=255)

    # Identity
    username: Optional[str] = Field(default=None, unique=True, index=True, max_length=50)
    display_name: Optional[str] = Field(default=None, max_length=100)
    trust_level: int = Field(default=0, ge=0)

    # Admin flag
    is_admin: bool = Field(default=False)

    # Trusted organizer (auto-approve featured bookings)
    is_trusted_organizer: bool = Field(default=False)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    check_ins: list["CheckIn"] = Relationship(back_populates="user")
    submitted_events: list["Event"] = Relationship(back_populates="organizer")
    owned_venues: list["Venue"] = Relationship(back_populates="owner")
    payments: list["Payment"] = Relationship(back_populates="user")
    bookmarks: list["Bookmark"] = Relationship(back_populates="user")
    organizer_profiles: list["Organizer"] = Relationship(back_populates="user")
    following: list["Follow"] = Relationship(back_populates="follower")
    group_memberships: list["GroupMember"] = Relationship(back_populates="user")
    venue_staff: list["VenueStaff"] = Relationship(back_populates="user")
    preferences: Optional["UserPreferences"] = Relationship(back_populates="user")
    featured_bookings: list["FeaturedBooking"] = Relationship(back_populates="organizer")
