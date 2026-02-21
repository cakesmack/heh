from typing import Optional, List, Dict, Any, Union
import re
from pydantic import BaseModel, model_validator
from datetime import datetime

def _sanitize_url(value: Union[str, None]) -> Union[str, None]:
    """Trim whitespace, convert blanks to None, auto-prepend https:// if missing."""
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    
    # If it is already a full URL, or a Cloudinary shortcut, return it
    if re.match(r'^https?://', trimmed, re.IGNORECASE):
        return trimmed
    
    # If it looks like a Cloudflare Image ID (UUID format), do NOT prepend https://
    if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', trimmed, re.IGNORECASE):
        return trimmed

    # Otherwise prepend https://
    return f'https://{trimmed}'

class OrganizerBase(BaseModel):
    name: str
    bio: Optional[str] = None
    logo_url: Optional[str] = None
    hero_image_url: Optional[str] = None
    website_url: Optional[str] = None
    social_links: Optional[Dict[str, Any]] = None
    # Enhanced profile fields
    group_type: Optional[str] = None
    category_focus: Optional[str] = None
    cover_image_url: Optional[str] = None
    city: Optional[str] = None
    social_facebook: Optional[str] = None
    social_instagram: Optional[str] = None
    social_website: Optional[str] = None
    public_email: Optional[str] = None
    contact_number: Optional[str] = None
    is_verified: bool = False

class OrganizerCreate(OrganizerBase):
    @model_validator(mode='before')
    @classmethod
    def sanitize_urls(cls, data):
        if isinstance(data, dict):
            for field in ('logo_url', 'hero_image_url', 'website_url', 'cover_image_url', 'social_website'):
                if field in data:
                    data[field] = _sanitize_url(data.get(field))
        return data

class OrganizerUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    logo_url: Optional[str] = None
    hero_image_url: Optional[str] = None
    website_url: Optional[str] = None
    social_links: Optional[Dict[str, Any]] = None
    # Enhanced profile fields
    group_type: Optional[str] = None
    category_focus: Optional[str] = None
    cover_image_url: Optional[str] = None
    city: Optional[str] = None
    social_facebook: Optional[str] = None
    social_instagram: Optional[str] = None
    social_website: Optional[str] = None
    public_email: Optional[str] = None
    contact_number: Optional[str] = None
    is_verified: Optional[bool] = None

    @model_validator(mode='before')
    @classmethod
    def sanitize_urls(cls, data):
        if isinstance(data, dict):
            for field in ('logo_url', 'hero_image_url', 'website_url', 'cover_image_url', 'social_website'):
                if field in data:
                    data[field] = _sanitize_url(data.get(field))
        return data

class OrganizerResponse(OrganizerBase):
    id: str
    slug: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    upcoming_events_count: int = 0
    # Computed stats (populated by API)
    total_events_hosted: Optional[int] = None
    follower_count: Optional[int] = None
    
    class Config:
        from_attributes = True

class OrganizerListResponse(BaseModel):
    organizers: List[OrganizerResponse]
    total: int
