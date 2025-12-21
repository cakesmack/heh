"""
Pydantic schemas for Venue Claim operations.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from .user import UserResponse
from .venue import VenueResponse

class VenueClaimBase(BaseModel):
    venue_id: str
    reason: Optional[str] = None

class VenueClaimCreate(VenueClaimBase):
    pass

class VenueClaimUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None

class VenueClaimResponse(VenueClaimBase):
    id: int
    user_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    user: Optional[UserResponse] = None
    venue: Optional[VenueResponse] = None

    class Config:
        from_attributes = True
