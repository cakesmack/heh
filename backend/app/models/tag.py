"""
Tag model for user-generated event classification.
Includes EventTag junction table for many-to-many relationship.
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING, List
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship
import re

if TYPE_CHECKING:
    from .event import Event


def normalize_tag_name(name: str) -> str:
    """Normalize tag name: lowercase, hyphens for spaces, no special chars."""
    normalized = name.lower().strip()
    normalized = re.sub(r'[^\w\s-]', '', normalized)
    normalized = re.sub(r'[\s_]+', '-', normalized)
    return normalized


class EventTag(SQLModel, table=True):
    """Junction table for Event-Tag many-to-many relationship."""
    __tablename__ = "event_tags"

    event_id: str = Field(foreign_key="events.id", primary_key=True)
    tag_id: str = Field(foreign_key="tags.id", primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Tag(SQLModel, table=True):
    """
    Tag model for classifying events.

    Attributes:
        id: Unique tag identifier
        name: Normalized tag name (lowercase, hyphens)
        usage_count: Number of events using this tag
        created_at: Creation timestamp
    """
    __tablename__ = "tags"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    name: str = Field(max_length=50, unique=True, index=True)
    slug: Optional[str] = Field(default=None, max_length=100, index=True)
    usage_count: int = Field(default=0, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    events: List["Event"] = Relationship(back_populates="tags", link_model=EventTag)
