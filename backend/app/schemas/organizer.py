from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime

class OrganizerBase(BaseModel):
    name: str
    bio: Optional[str] = None
    logo_url: Optional[str] = None
    hero_image_url: Optional[str] = None
    website_url: Optional[str] = None
    social_links: Optional[Dict[str, Any]] = None
    # Enhanced profile fields
    cover_image_url: Optional[str] = None
    city: Optional[str] = None
    social_facebook: Optional[str] = None
    social_instagram: Optional[str] = None
    social_website: Optional[str] = None
    public_email: Optional[str] = None
    contact_number: Optional[str] = None

class OrganizerCreate(OrganizerBase):
    pass

class OrganizerUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    logo_url: Optional[str] = None
    hero_image_url: Optional[str] = None
    website_url: Optional[str] = None
    social_links: Optional[Dict[str, Any]] = None
    # Enhanced profile fields
    cover_image_url: Optional[str] = None
    city: Optional[str] = None
    social_facebook: Optional[str] = None
    social_instagram: Optional[str] = None
    social_website: Optional[str] = None
    public_email: Optional[str] = None
    contact_number: Optional[str] = None

class OrganizerResponse(OrganizerBase):
    id: str
    slug: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    # Computed stats (populated by API)
    total_events_hosted: Optional[int] = None
    follower_count: Optional[int] = None
    
    class Config:
        from_attributes = True

class OrganizerListResponse(BaseModel):
    organizers: List[OrganizerResponse]
    total: int
