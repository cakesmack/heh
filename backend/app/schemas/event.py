"""
Pydantic schemas for event-related API requests and responses.
Handles event creation, updates, filtering, and listings.
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

from app.schemas.category import CategoryResponse
from app.schemas.category import CategoryResponse
from app.schemas.tag import TagResponse
from app.schemas.venue import VenueResponse


class EventCreate(BaseModel):
    """Schema for creating a new event."""
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    date_start: datetime
    date_end: datetime
    venue_id: Optional[UUID] = None
    location_name: Optional[str] = Field(None, max_length=255)
    category_id: str
    tags: Optional[List[str]] = Field(None, max_length=5, description="List of tag names (max 5)")
    price: float = Field(default=0.0, ge=0.0)
    image_url: Optional[str] = Field(None, max_length=500)
    # Phase 2.10 additions
    ticket_url: Optional[str] = Field(None, max_length=500)
    age_restriction: Optional[str] = Field(None, max_length=50)
    # Phase 2.3 additions
    organizer_profile_id: Optional[UUID] = None
    is_recurring: Optional[bool] = False
    frequency: Optional[str] = Field(None, description="WEEKLY, BIWEEKLY, MONTHLY")
    recurrence_end_date: Optional[datetime] = None
    # recurrence_rule is now internal/derived, but we can keep it for flexibility if needed, 
    # though the user request implies the backend handles the translation. 
    # Let's keep it optional but prioritize frequency.
    recurrence_rule: Optional[str] = Field(None, max_length=500)
    # Custom Location (Phase 3)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Participating Venues (Phase 3)
    participating_venue_ids: Optional[List[UUID]] = Field(None, description="List of IDs for other participating venues")

class EventUpdate(BaseModel):
    """Schema for updating an existing event."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1, max_length=5000)
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    venue_id: Optional[UUID] = None
    location_name: Optional[str] = Field(None, max_length=255)
    category_id: Optional[str] = None
    tags: Optional[List[str]] = Field(None, description="List of tag names")
    price: Optional[float] = Field(None, ge=0.0)
    image_url: Optional[str] = Field(None, max_length=500)
    # Phase 2.10 additions
    ticket_url: Optional[str] = Field(None, max_length=500)
    age_restriction: Optional[str] = Field(None, max_length=50)
    # Phase 2.3 additions
    organizer_profile_id: Optional[UUID] = None
    recurrence_rule: Optional[str] = Field(None, max_length=500)
    is_recurring: Optional[bool] = None


class EventResponse(BaseModel):
    """Schema for event response with all details."""
    id: UUID
    title: str
    description: str
    date_start: datetime
    date_end: datetime
    venue_id: Optional[UUID]
    location_name: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    geohash: Optional[str]
    category_id: Optional[str]
    price: float
    featured: bool
    featured_until: Optional[datetime]
    organizer_id: UUID
    image_url: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    # Phase 2.10 additions
    ticket_url: Optional[str] = None
    age_restriction: Optional[str] = None
    postcode: Optional[str] = None
    address_full: Optional[str] = None
    
    # Phase 2.3 additions
    organizer_profile_id: Optional[UUID] = None
    recurrence_rule: Optional[str] = None
    is_recurring: bool = False
    parent_event_id: Optional[UUID] = None

    # Nested related data
    category: Optional[CategoryResponse] = None
    tags: Optional[List[TagResponse]] = None
    participating_venues: List[VenueResponse] = []

    # Computed fields (populated by endpoint logic)
    venue_name: Optional[str] = None
    distance_km: Optional[float] = None
    checkin_count: Optional[int] = None
    view_count: int = 0
    save_count: int = 0
    ticket_click_count: int = 0
    organizer_email: Optional[str] = None
    organizer_profile_name: Optional[str] = None

    class Config:
        from_attributes = True


class EventFilter(BaseModel):
    """Schema for filtering events."""
    category_id: Optional[str] = None
    category_ids: Optional[List[str]] = Field(None, description="Filter by multiple categories")
    tag_names: Optional[List[str]] = Field(None, description="Filter by tag names")
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    price_min: Optional[float] = Field(None, ge=0.0)
    price_max: Optional[float] = Field(None, ge=0.0)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = Field(None, ge=0.0)
    featured_only: Optional[bool] = False
    status: Optional[str] = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=100)


class EventListResponse(BaseModel):
    """Schema for paginated event list response."""
    events: list[EventResponse]
    total: int
    skip: int
    limit: int
