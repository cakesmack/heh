"""
Notification model for in-app notification history.
Tracks user notifications for event approvals, venue claims, and system messages.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, String, ForeignKey

if TYPE_CHECKING:
    from .user import User


class NotificationType(str, Enum):
    """Types of notifications."""
    EVENT_SUBMITTED = "event_submitted"
    EVENT_APPROVED = "event_approved"
    EVENT_REJECTED = "event_rejected"
    VENUE_CLAIM_APPROVED = "venue_claim_approved"
    VENUE_CLAIM_REJECTED = "venue_claim_rejected"
    FEATURED_APPROVED = "featured_approved"
    FEATURED_REJECTED = "featured_rejected"
    SYSTEM = "system"


class Notification(SQLModel, table=True):
    """
    Notification model for storing user notification history.

    Attributes:
        id: Unique notification identifier
        user_id: User who receives the notification
        type: Type of notification (event_approved, venue_claim, etc.)
        title: Short notification title
        message: Full notification message
        link: Optional URL to navigate to
        is_read: Whether the notification has been read
        created_at: When the notification was created
    """
    __tablename__ = "notifications"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    user_id: str = Field(
        sa_column=Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    )

    # Notification content
    type: NotificationType = Field(index=True)
    title: str = Field(max_length=255)
    message: str = Field(max_length=1000)
    link: Optional[str] = Field(default=None, max_length=500)

    # Status
    is_read: bool = Field(default=False, index=True)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    # Relationships
    user: "User" = Relationship(back_populates="notifications")
