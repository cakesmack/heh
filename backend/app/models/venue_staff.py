from datetime import datetime
from enum import Enum
from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .user import User
    from .venue import Venue

class VenueRole(str, Enum):
    MANAGER = "manager"
    STAFF = "staff"

class VenueStaff(SQLModel, table=True):
    __tablename__ = "venue_staff"

    id: Optional[int] = Field(default=None, primary_key=True)
    venue_id: str = Field(foreign_key="venues.id", index=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    role: VenueRole = Field(default=VenueRole.STAFF)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    venue: Optional["Venue"] = Relationship()
    user: Optional["User"] = Relationship()
