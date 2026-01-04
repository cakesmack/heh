"""
Bookmark model for user-saved events.
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, String, ForeignKey

if TYPE_CHECKING:
    from .user import User
    from .event import Event

class Bookmark(SQLModel, table=True):
    """
    Bookmark model representing a user saving an event.
    """
    __tablename__ = "bookmarks"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    user_id: str = Field(
        sa_column=Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    )
    event_id: str = Field(
        sa_column=Column(String, ForeignKey("events.id", ondelete="CASCADE"), index=True)
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: "User" = Relationship(back_populates="bookmarks")
    event: "Event" = Relationship(back_populates="bookmarks")
