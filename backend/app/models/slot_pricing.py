"""
SlotPricing model for configurable featured slot pricing.
Allows admin to update pricing without code changes.
"""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel

from app.models.featured_booking import SlotType


class SlotPricing(SQLModel, table=True):
    """
    Configurable pricing for featured slots.
    One row per slot type.
    """
    __tablename__ = "slot_pricing"

    slot_type: str = Field(primary_key=True)  # SlotType value
    price_per_day: int = Field(default=1000)  # In pence
    min_days: int = Field(default=3)
    max_concurrent: int = Field(default=3)
    is_active: bool = Field(default=True)
    description: Optional[str] = Field(default=None)

    updated_at: datetime = Field(default_factory=datetime.utcnow)


# Default pricing configuration (used for seeding)
DEFAULT_PRICING = {
    SlotType.HERO_HOME.value: {
        "price_per_day": 4000,
        "min_days": 3,
        "max_concurrent": 5,
        "description": "Homepage hero carousel - maximum visibility"
    },
    SlotType.GLOBAL_PINNED.value: {
        "price_per_day": 2000,
        "min_days": 3,
        "max_concurrent": 3,
        "description": "Pinned at top of all events list"
    },
    SlotType.CATEGORY_PINNED.value: {
        "price_per_day": 1000,
        "min_days": 3,
        "max_concurrent": 3,
        "description": "Pinned at top of category page"
    },
    SlotType.MAGAZINE_CAROUSEL.value: {
        "price_per_day": 1500,
        "min_days": 1,
        "max_concurrent": 3,
        "description": "Featured in Magazine section"
    },
}
