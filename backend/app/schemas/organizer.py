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

class OrganizerCreate(OrganizerBase):
    pass

class OrganizerUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    logo_url: Optional[str] = None
    hero_image_url: Optional[str] = None
    website_url: Optional[str] = None
    social_links: Optional[Dict[str, Any]] = None

class OrganizerResponse(OrganizerBase):
    id: str
    slug: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class OrganizerListResponse(BaseModel):
    organizers: List[OrganizerResponse]
    total: int

