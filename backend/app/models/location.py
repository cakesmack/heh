"""
Location model for Geographic Hub pages.
Powers SEO metadata, hero images, and featured events for /locations/[city] pages.
This is STRICTLY for SEO/Hero data — NOT related to Venue or Event location fields.
"""
from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime


class Location(SQLModel, table=True):
    __tablename__ = "locations"

    id: int = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, index=True)           # Display name, e.g. "Inverness"
    slug: str = Field(max_length=100, unique=True, index=True)  # URL slug, e.g. "inverness"

    # SEO Fields
    seo_meta_title: Optional[str] = Field(default=None, max_length=200)
    seo_meta_description: Optional[str] = Field(default=None, max_length=500)
    seo_anchor_text: Optional[str] = Field(default=None, max_length=1000)

    # Hero
    hero_image_url: Optional[str] = Field(default=None, max_length=500)

    # Official Partner Fields
    partner_logo: Optional[str] = Field(default=None, max_length=500)
    partner_url: Optional[str] = Field(default=None, max_length=500)
    partner_name: Optional[str] = Field(default=None, max_length=200)

    # Featured Event (FK to events.id — not enforced via ORM to keep this decoupled)
    featured_event_id: Optional[str] = Field(default=None, max_length=64)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
