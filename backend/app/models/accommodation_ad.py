"""
AccommodationAd model for location-based accommodation advertising.
Supports a maximum of 3 concurrent ads per location via interval overlap validation.
"""
from datetime import datetime, date
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Integer, ForeignKey


class AccommodationAd(SQLModel, table=True):
    __tablename__ = "accommodation_ads"

    id: int = Field(default=None, primary_key=True)

    # Content
    title: str = Field(max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    destination_url: str = Field(max_length=500)
    image_url: str = Field(max_length=500)

    # Location binding (strict FK to locations.id)
    location_id: int = Field(
        sa_column=Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    )

    # Scheduling
    start_date: date = Field(index=True)
    end_date: date = Field(index=True)

    # Status
    is_active: bool = Field(default=True, index=True)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship (for joined queries)
    location: Optional["Location"] = Relationship()


# Import here to avoid circular imports at module level
from app.models.location import Location  # noqa: E402, F811
