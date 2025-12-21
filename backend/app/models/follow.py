from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .user import User

class Follow(SQLModel, table=True):
    """
    Model representing a user following a target (Venue or Organizer).
    """
    __tablename__ = "follows"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    follower_id: str = Field(foreign_key="users.id", index=True)
    target_id: str = Field(index=True) # ID of Venue or Organizer
    target_type: str = Field(index=True) # 'venue' or 'group'
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    follower: "User" = Relationship(back_populates="following")
