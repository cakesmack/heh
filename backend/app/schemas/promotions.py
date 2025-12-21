"""
Pydantic schemas for promotion-related API requests and responses.
Handles venue promotions and discount offers.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.promotion import DiscountType


class PromotionCreate(BaseModel):
    """Schema for creating a new promotion."""
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=1000)
    discount_type: DiscountType = DiscountType.OTHER
    discount_value: Optional[int] = Field(None, ge=0)
    requires_checkin: bool = True
    expires_at: Optional[datetime] = None
    active: bool = True


class PromotionUpdate(BaseModel):
    """Schema for updating an existing promotion."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1, max_length=1000)
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[int] = Field(None, ge=0)
    requires_checkin: Optional[bool] = None
    expires_at: Optional[datetime] = None
    active: Optional[bool] = None


class PromotionResponse(BaseModel):
    """Schema for promotion response."""
    id: UUID
    venue_id: UUID
    title: str
    description: str
    discount_type: DiscountType
    discount_value: Optional[int]
    requires_checkin: bool
    expires_at: Optional[datetime]
    active: bool
    created_at: datetime

    # Computed fields
    venue_name: Optional[str] = None
    is_unlocked: Optional[bool] = None
    distance_km: Optional[float] = None

    class Config:
        from_attributes = True


class PromotionListResponse(BaseModel):
    """Schema for paginated promotion list response."""
    promotions: list[PromotionResponse]
    total: int
