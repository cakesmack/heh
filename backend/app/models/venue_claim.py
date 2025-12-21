"""
Venue Claim model for managing venue ownership requests.
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .user import User
    from .venue import Venue

class VenueClaim(SQLModel, table=True):
    """
    Represents a user's request to claim ownership of a venue.
    """
    __tablename__ = "venue_claims"

    id: Optional[int] = Field(default=None, primary_key=True)
    venue_id: str = Field(foreign_key="venues.id")
    user_id: str = Field(foreign_key="users.id")
    status: str = Field(default="pending")  # pending, approved, rejected
    reason: Optional[str] = Field(default=None)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    venue: "Venue" = Relationship()
    user: "User" = Relationship()
