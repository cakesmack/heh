"""
Pydantic schemas for payment-related API requests and responses.
Handles Stripe payments for featured event listings (Phase 2).
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.payment import PaymentStatus


class PaymentCreate(BaseModel):
    """Schema for creating a payment (featured listing)."""
    event_id: UUID
    amount: int = Field(ge=0, description="Amount in cents")
    currency: str = Field(default="gbp", max_length=3)
    description: Optional[str] = Field(None, max_length=500)


class PaymentResponse(BaseModel):
    """Schema for payment response."""
    id: UUID
    user_id: UUID
    event_id: Optional[UUID]
    stripe_payment_intent_id: str
    amount: int
    currency: str
    status: PaymentStatus
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CheckoutSessionResponse(BaseModel):
    """Schema for Stripe Checkout session response."""
    session_id: str
    session_url: str
    payment_id: UUID


class StripeWebhookEvent(BaseModel):
    """Schema for Stripe webhook event."""
    type: str
    data: dict


class PaymentListResponse(BaseModel):
    """Schema for paginated payment list response."""
    payments: list[PaymentResponse]
    total: int
