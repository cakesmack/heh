"""
UserPreferences model for email notification settings.
Stores per-user preferences for marketing emails, weekly digest, and category interests.
"""
import secrets
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship, Column
from sqlalchemy import JSON

if TYPE_CHECKING:
    from .user import User


class UserPreferences(SQLModel, table=True):
    """
    User preferences for email notifications and category interests.

    Created automatically when a user registers.
    1:1 relationship with User (user_id is primary key).
    """
    __tablename__ = "user_preferences"

    user_id: str = Field(foreign_key="users.id", primary_key=True)

    # Email permissions (GDPR-compliant, default opt-in)
    marketing_emails: bool = Field(default=True)
    weekly_digest: bool = Field(default=True)
    organizer_alerts: bool = Field(default=True)

    # Category preferences for personalized digest (stores category slugs)
    preferred_categories: List[str] = Field(default=[], sa_column=Column(JSON))

    # One-click unsubscribe token (no login required)
    unsubscribe_token: str = Field(default_factory=lambda: secrets.token_urlsafe(32))

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship
    user: "User" = Relationship(back_populates="preferences")
