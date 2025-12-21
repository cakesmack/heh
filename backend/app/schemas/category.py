"""
Pydantic schemas for category-related API requests and responses.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
import re


def generate_slug(name: str) -> str:
    """Generate URL-friendly slug from name."""
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    return slug


class CategoryCreate(BaseModel):
    """Schema for creating a new category."""
    name: str = Field(min_length=1, max_length=100)
    slug: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    image_url: Optional[str] = Field(None, max_length=500)
    gradient_color: str = Field(default="#6B7280", max_length=7, pattern=r'^#[0-9A-Fa-f]{6}$')
    display_order: int = Field(default=0, ge=0)
    is_active: bool = Field(default=True)


class CategoryUpdate(BaseModel):
    """Schema for updating a category."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    slug: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    image_url: Optional[str] = Field(None, max_length=500)
    gradient_color: Optional[str] = Field(None, max_length=7, pattern=r'^#[0-9A-Fa-f]{6}$')
    display_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    """Schema for category response."""
    id: str
    name: str
    slug: str
    description: Optional[str]
    image_url: Optional[str]
    gradient_color: str
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    event_count: Optional[int] = None

    class Config:
        from_attributes = True


class CategoryListResponse(BaseModel):
    """Schema for category list response."""
    categories: list[CategoryResponse]
    total: int
