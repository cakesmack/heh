from datetime import datetime
from typing import Optional, TYPE_CHECKING
from enum import Enum
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .user import User
    from .organizer import Organizer

class GroupRole(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    EDITOR = "EDITOR"

class GroupMember(SQLModel, table=True):
    """
    Model representing a user's membership in a group (Organizer).
    """
    __tablename__ = "group_members"

    group_id: str = Field(foreign_key="organizers.id", primary_key=True)
    user_id: str = Field(foreign_key="users.id", primary_key=True)
    role: GroupRole = Field(default=GroupRole.EDITOR)
    joined_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: "User" = Relationship(back_populates="group_memberships")
    group: "Organizer" = Relationship(back_populates="members")
