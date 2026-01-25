"""
Hero Slot model for the homepage spotlight system.
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .event import Event

class HeroSlot(SQLModel, table=True):
    """
    Represents a slot in the homepage hero carousel.
    """
    __tablename__ = "hero_slots"

    id: Optional[int] = Field(default=None, primary_key=True)
    position: int = Field(index=True, unique=True)  # 1-5
    type: str = Field(default="spotlight_event")  # 'welcome' or 'spotlight_event'
    
    # Linked Event
    event_id: Optional[str] = Field(default=None, foreign_key="events.id")
    
    # New Link Field (Independent of Event)
    link: Optional[str] = Field(default=None, max_length=500)
    
    # Overrides
    image_override: Optional[str] = Field(default=None, max_length=500)
    image_override_left: Optional[str] = Field(default=None, max_length=500)
    image_override_right: Optional[str] = Field(default=None, max_length=500)
    title_override: Optional[str] = Field(default=None, max_length=255)
    cta_override: Optional[str] = Field(default=None, max_length=100)
    
    # Badge Info
    badge_text: Optional[str] = Field(default=None, max_length=50)
    badge_color: str = Field(default="emerald")  # emerald, amber, blue, etc.
    
    # Styling & Behavior
    overlay_style: str = Field(default="dark")  # 'dark', 'light', 'gradient'
    is_active: bool = Field(default=True)
    
    # Scheduling
    start_date: Optional[datetime] = Field(default=None)
    end_date: Optional[datetime] = Field(default=None)
    
    # Relationships
    event: Optional["Event"] = Relationship()
