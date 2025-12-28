"""
FeaturedBooking model for paid advertising slots.
Tracks slot reservations with date ranges and payment status.
"""
from datetime import datetime, date
from enum import Enum
from typing import Optional, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .event import Event
    from .user import User


class SlotType(str, Enum):
    """Types of featured placements available."""
    HERO_HOME = "hero_home"
    GLOBAL_PINNED = "global_pinned"
    CATEGORY_PINNED = "category_pinned"
    NEWSLETTER = "newsletter"


class BookingStatus(str, Enum):
    """Status workflow for featured bookings."""
    PENDING_PAYMENT = "pending_payment"
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


# Slot limits and pricing (pence)
SLOT_CONFIG = {
    SlotType.HERO_HOME: {"max": 5, "price_per_day": 4000, "min_days": 3},
    SlotType.GLOBAL_PINNED: {"max": 3, "price_per_day": 2000, "min_days": 3},
    SlotType.CATEGORY_PINNED: {"max": 3, "price_per_day": 1000, "min_days": 3},
    SlotType.NEWSLETTER: {"max": 2, "price_per_day": 1500, "min_days": 1},
}


class FeaturedBooking(SQLModel, table=True):
    """
    Represents a paid featured placement booking.

    Attributes:
        slot_type: Type of placement (hero, pinned, etc.)
        target_id: Category ID for CATEGORY_PINNED slots
        start_date/end_date: Date range for the booking
        status: Current status in the workflow
        amount_paid: Total paid in pence
    """
    __tablename__ = "featured_bookings"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    event_id: str = Field(foreign_key="events.id", index=True)
    organizer_id: str = Field(foreign_key="users.id", index=True)

    slot_type: SlotType = Field(index=True)
    target_id: Optional[str] = Field(default=None, index=True)  # Category ID for CATEGORY_PINNED

    start_date: date = Field(index=True)
    end_date: date = Field(index=True)

    status: BookingStatus = Field(default=BookingStatus.PENDING_PAYMENT, index=True)
    amount_paid: int = Field(default=0)  # In pence

    stripe_checkout_session_id: Optional[str] = Field(default=None, max_length=255)
    stripe_payment_intent_id: Optional[str] = Field(default=None, max_length=255)
    
    # Custom messaging for hero carousel
    custom_subtitle: Optional[str] = Field(default=None, max_length=200)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    event: "Event" = Relationship()
    organizer: "User" = Relationship(back_populates="featured_bookings")
