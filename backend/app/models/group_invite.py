from datetime import datetime, timedelta
from typing import Optional, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .organizer import Organizer

class GroupInvite(SQLModel, table=True):
    """
    Model for group invitation tokens.
    """
    __tablename__ = "group_invites"

    token: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    group_id: str = Field(foreign_key="organizers.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(default_factory=lambda: datetime.utcnow() + timedelta(days=7))
    
    # Relationships
    group: "Organizer" = Relationship(back_populates="invites")
