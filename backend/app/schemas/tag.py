"""
Pydantic schemas for tag-related API requests and responses.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class TagCreate(BaseModel):
    """Schema for creating tags (used internally)."""
    name: str = Field(min_length=1, max_length=50)


class TagResponse(BaseModel):
    """Schema for tag response."""
    id: str
    name: str
    slug: Optional[str] = None
    usage_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class TagListResponse(BaseModel):
    """Schema for tag list response."""
    tags: list[TagResponse]
    total: int


class EventTagsUpdate(BaseModel):
    """Schema for updating event tags."""
    tags: List[str] = Field(max_length=5, description="List of tag names (max 5)")
