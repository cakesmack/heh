"""
Pydantic schemas for Event Claim operations.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class EventClaimBase(BaseModel):
    reason: Optional[str] = None


class EventClaimCreate(EventClaimBase):
    pass


class EventClaimUpdate(BaseModel):
    status: str  # approved, rejected


class EventClaimResponse(EventClaimBase):
    id: int
    event_id: str
    user_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    
    # Nested data (populated via relationships or joins)
    event_title: Optional[str] = None
    user_email: Optional[str] = None
    
    class Config:
        from_attributes = True
