"""
Event Claim model for managing event ownership requests.
Allows users to "claim" an event they want to manage (e.g., venue owners, original organizers).
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .user import User
    from .event import Event

class EventClaim(SQLModel, table=True):
    """
    Represents a user's request to claim ownership/management of an event.
    Similar to VenueClaim - requires admin approval.
    """
    __tablename__ = "event_claims"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: str = Field(foreign_key="events.id", index=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    status: str = Field(default="pending")  # pending, approved, rejected
    reason: Optional[str] = Field(default=None, max_length=1000)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    event: "Event" = Relationship()
    user: "User" = Relationship()
