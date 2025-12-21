"""
Category model for event classification.
Admin-controlled categories with visual styling for homepage grid.
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING, List
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .event import Event


class Category(SQLModel, table=True):
    """
    Category model for classifying events.

    Attributes:
        id: Unique category identifier
        name: Display name (e.g., "Live Music")
        slug: URL-friendly name (e.g., "live-music")
        description: Optional description for SEO/tooltips
        image_url: Background image for category grid
        gradient_color: Hex color for gradient overlay
        display_order: Sort order in category grid
        is_active: Soft delete flag
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    __tablename__ = "categories"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    name: str = Field(max_length=100, unique=True, index=True)
    slug: str = Field(max_length=100, unique=True, index=True)
    description: Optional[str] = Field(default=None, max_length=500)
    image_url: Optional[str] = Field(default=None, max_length=500)
    gradient_color: str = Field(default="#6B7280", max_length=7)  # Default gray
    display_order: int = Field(default=0, index=True)
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    events: List["Event"] = Relationship(back_populates="category_rel")
