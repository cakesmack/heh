"""
Pydantic schemas for Hero Slot operations.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from .event import EventResponse

class HeroSlotBase(BaseModel):
    position: int
    type: str = "spotlight_event"
    event_id: Optional[str] = None
    image_override: Optional[str] = None
    image_override_left: Optional[str] = None
    image_override_right: Optional[str] = None
    title_override: Optional[str] = None
    cta_override: Optional[str] = None
    overlay_style: str = "dark"
    is_active: bool = True
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class HeroSlotCreate(HeroSlotBase):
    pass

class HeroSlotUpdate(BaseModel):
    type: Optional[str] = None
    event_id: Optional[str] = None
    image_override: Optional[str] = None
    image_override_left: Optional[str] = None
    image_override_right: Optional[str] = None
    title_override: Optional[str] = None
    cta_override: Optional[str] = None
    overlay_style: Optional[str] = None
    is_active: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class HeroSlotResponse(HeroSlotBase):
    id: int
    event: Optional[EventResponse] = None

    class Config:
        from_attributes = True
