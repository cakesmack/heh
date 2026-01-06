"""
Pydantic schemas for venue-related API requests and responses.
Handles venue creation, updates, and listings.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class VenueCategoryResponse(BaseModel):
    """Schema for venue category response."""
    id: str
    name: str
    slug: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class VenueCategoryCreate(BaseModel):
    """Schema for creating a new venue category."""
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class VenueCategoryUpdate(BaseModel):
    """Schema for updating a venue category."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    slug: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class VenueCreate(BaseModel):
    """Schema for creating a new venue."""
    name: str = Field(min_length=1, max_length=255)
    address: str = Field(min_length=1, max_length=500)
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    category_id: str = Field(..., description="Venue category is required")
    description: Optional[str] = Field(None, max_length=2000)
    website: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    opening_hours: Optional[str] = Field(None, max_length=500)
    image_url: Optional[str] = Field(None, max_length=500)
    formatted_address: Optional[str] = Field(None, max_length=500)
    # Phase 2.10 additions
    postcode: Optional[str] = Field(None, max_length=10)
    address_full: Optional[str] = Field(None, max_length=500)
    # Amenities (Phase 2.3 Sprint 2)
    is_dog_friendly: bool = False
    has_wheelchair_access: bool = False
    has_parking: bool = False
    serves_food: bool = False
    amenities_notes: Optional[str] = Field(None, max_length=500)
    # Social Media Links
    social_facebook: Optional[str] = Field(None, max_length=255)
    social_instagram: Optional[str] = Field(None, max_length=255)
    social_x: Optional[str] = Field(None, max_length=255)
    social_linkedin: Optional[str] = Field(None, max_length=255)
    social_tiktok: Optional[str] = Field(None, max_length=255)
    website_url: Optional[str] = Field(None, max_length=255)


class VenueUpdate(BaseModel):
    """Schema for updating an existing venue."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    address: Optional[str] = Field(None, min_length=1, max_length=500)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    category_id: Optional[str] = None
    description: Optional[str] = Field(None, max_length=2000)
    website: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    opening_hours: Optional[str] = Field(None, max_length=500)
    image_url: Optional[str] = Field(None, max_length=500)
    formatted_address: Optional[str] = Field(None, max_length=500)
    # Phase 2.10 additions
    postcode: Optional[str] = Field(None, max_length=10)
    address_full: Optional[str] = Field(None, max_length=500)
    # Amenities (Phase 2.3 Sprint 2)
    is_dog_friendly: Optional[bool] = None
    has_wheelchair_access: Optional[bool] = None
    has_parking: Optional[bool] = None
    serves_food: Optional[bool] = None
    amenities_notes: Optional[str] = Field(None, max_length=500)
    # Social Media Links
    social_facebook: Optional[str] = Field(None, max_length=255)
    social_instagram: Optional[str] = Field(None, max_length=255)
    social_x: Optional[str] = Field(None, max_length=255)
    social_linkedin: Optional[str] = Field(None, max_length=255)
    social_tiktok: Optional[str] = Field(None, max_length=255)
    website_url: Optional[str] = Field(None, max_length=255)


class VenueResponse(BaseModel):
    """Schema for venue response with all details."""
    id: UUID
    name: str
    address: str
    latitude: float
    longitude: float
    geohash: Optional[str]
    category_id: Optional[str] = None
    category: Optional[VenueCategoryResponse] = Field(None, alias="category_rel")
    description: Optional[str]
    website: Optional[str]
    phone: Optional[str]
    email: Optional[str] = None
    opening_hours: Optional[str] = None
    image_url: Optional[str]
    formatted_address: Optional[str]
    owner_id: Optional[UUID]
    created_at: datetime

    # Phase 2.10 additions
    postcode: Optional[str] = None
    address_full: Optional[str] = None

    # Amenities (Phase 2.3 Sprint 2)
    is_dog_friendly: bool = False
    has_wheelchair_access: bool = False
    has_parking: bool = False
    serves_food: bool = False
    amenities_notes: Optional[str] = None
    # Social Media Links
    social_facebook: Optional[str] = None
    social_instagram: Optional[str] = None
    social_x: Optional[str] = None
    social_linkedin: Optional[str] = None
    social_tiktok: Optional[str] = None
    website_url: Optional[str] = None
    owner_email: Optional[str] = None
    staff: list["VenueStaffResponse"] = []

    # Computed fields (populated by endpoint logic)
    upcoming_events_count: Optional[int] = None
    distance_km: Optional[float] = None

    class Config:
        from_attributes = True


class VenueFilter(BaseModel):
    """Schema for filtering venues."""
    category_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = Field(None, ge=0.0)
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=100)


class VenueListResponse(BaseModel):
    """Schema for paginated venue list response."""
    venues: list[VenueResponse]
    total: int
    skip: int
    limit: int

class VenueStaffResponse(BaseModel):
    id: int
    venue_id: str
    user_id: str
    role: str
    created_at: datetime
    user_email: Optional[str] = None
    user_display_name: Optional[str] = None

    class Config:
        from_attributes = True

class VenueStaffCreate(BaseModel):
    user_email: str
    role: str = "staff"


class VenueStatsResponse(BaseModel):
    """Schema for venue stats response."""
    total_events: int
    upcoming_events: int
    last_event_date: Optional[datetime] = None
