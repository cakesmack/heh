"""
Venue Category model.
Allows dynamic management of venue types (e.g., Pub, Restaurant, Museum).
"""
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .venue import Venue


class VenueCategory(SQLModel, table=True):
    """
    Venue Category model.
    
    Attributes:
        id: Unique identifier
        name: Display name (e.g., "Pub")
        slug: URL-friendly name (e.g., "pub")
        description: Optional description
        created_at: Creation timestamp
    """
    __tablename__ = "venue_categories"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    name: str = Field(max_length=100, unique=True, index=True)
    slug: str = Field(max_length=100, unique=True, index=True)
    description: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    venues: List["Venue"] = Relationship(back_populates="category_rel")
