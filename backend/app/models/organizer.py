from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import JSON, Column

if TYPE_CHECKING:
    from .user import User
    from .event import Event
    from .group_member import GroupMember
    from .group_invite import GroupInvite

class Organizer(SQLModel, table=True):
    """
    Organizer model representing a group or entity that hosts events.
    Distinct from the User account, allowing one user to manage multiple organizer profiles.
    """
    __tablename__ = "organizers"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    name: str = Field(index=True, max_length=255)
    slug: str = Field(unique=True, index=True)
    bio: Optional[str] = Field(default=None, max_length=2000)
    logo_url: Optional[str] = Field(default=None, max_length=500)
    hero_image_url: Optional[str] = Field(default=None, max_length=500)
    
    # Socials (legacy - JSON blob)
    website_url: Optional[str] = Field(default=None, max_length=500)
    social_links: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    # Enhanced Profile Fields (Part 2)
    cover_image_url: Optional[str] = Field(default=None, max_length=500)  # 3:1 aspect ratio banner
    city: Optional[str] = Field(default=None, max_length=100)
    social_facebook: Optional[str] = Field(default=None, max_length=500)
    social_instagram: Optional[str] = Field(default=None, max_length=500)
    social_website: Optional[str] = Field(default=None, max_length=500)
    public_email: Optional[str] = Field(default=None, max_length=255)
    
    # Owner of this profile
    user_id: str = Field(foreign_key="users.id", index=True)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: "User" = Relationship(back_populates="organizer_profiles")
    events: List["Event"] = Relationship(back_populates="organizer_profile")
    members: List["GroupMember"] = Relationship(back_populates="group")
    invites: List["GroupInvite"] = Relationship(back_populates="group")
