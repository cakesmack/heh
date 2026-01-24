"""
Promotion model for venue-specific offers unlocked via check-ins.
Encourages user engagement and venue participation.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, String, ForeignKey

if TYPE_CHECKING:
    from .venue import Venue


class DiscountType(str, Enum):
    """Types of discounts offered in promotions."""
    PERCENTAGE = "percentage"  # e.g., 10% off
    FIXED_AMOUNT = "fixed_amount"  # e.g., £5 off
    FREE_ITEM = "free_item"  # e.g., free drink
    TWO_FOR_ONE = "two_for_one"
    OTHER = "other"


class Promotion(SQLModel, table=True):
    """
    Promotion model representing venue offers.

    Attributes:
        id: Unique promotion identifier
        venue_id: Associated venue
        title: Promotion title
        description: Promotion details
        discount_type: Type of discount
        discount_value: Numeric value (percentage or amount)
        requires_checkin: Whether check-in is required to unlock
        expires_at: Expiry date/time
        active: Whether promotion is currently active
        created_at: Creation timestamp
    """
    __tablename__ = "promotions"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    venue_id: str = Field(
        sa_column=Column(String, ForeignKey("venues.id", ondelete="CASCADE"), index=True)
    )

    # Promotion details
    title: str = Field(max_length=255)
    description: str = Field(max_length=1000)

    # Discount configuration
    discount_type: DiscountType = Field(default=DiscountType.OTHER)
    discount_value: Optional[int] = Field(default=None)  # Percentage or fixed amount

    # Requirements
    # Check-in requirement removed to support feature purge

    # Validity
    expires_at: Optional[datetime] = Field(default=None, index=True)
    active: bool = Field(default=True, index=True)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    venue: "Venue" = Relationship(back_populates="promotions")
