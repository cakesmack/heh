"""
Venue Invite model for managing venue ownership invitations.
Admin-generated tokens for instant ownership transfer.
"""
from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship

class VenueInvite(SQLModel, table=True):
    """
    Represents an admin-generated invitation for venue ownership.
    Token-based system for instant ownership transfer without approval.
    """
    __tablename__ = "venue_invites"

    id: int = Field(default=None, primary_key=True)
    venue_id: str = Field(foreign_key="venues.id", index=True)
    email: str = Field(max_length=255, index=True)
    token: str = Field(
        default_factory=lambda: str(uuid4()).replace("-", ""),
        unique=True,
        index=True
    )
    claimed: bool = Field(default=False)
    claimed_by_user_id: Optional[str] = Field(default=None, foreign_key="users.id")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(
        default_factory=lambda: datetime.utcnow() + timedelta(days=7)
    )
    claimed_at: Optional[datetime] = Field(default=None)
