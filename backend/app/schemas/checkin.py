"""
Pydantic schemas for check-in related API requests and responses.
Handles check-in validation and XP award responses.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class CheckInRequest(BaseModel):
    """Schema for check-in request."""
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    device_time: Optional[datetime] = None


class CheckInResponse(BaseModel):
    """Schema for check-in response."""
    success: bool
    message: str
    promotion_unlocked: Optional[dict] = None
    checkin_id: Optional[UUID] = None

    class Config:
        from_attributes = True


class CheckInHistory(BaseModel):
    """Schema for user's check-in history."""
    id: UUID
    event_id: UUID
    event_title: Optional[str] = None
    venue_name: Optional[str] = None
    timestamp: datetime
    is_first_at_venue: bool
    is_night_checkin: bool

    class Config:
        from_attributes = True


class CheckInStatsResponse(BaseModel):
    """Schema for check-in statistics."""
    total_checkins: int
    unique_venues: int
    first_checkin: Optional[datetime] = None
    last_checkin: Optional[datetime] = None
