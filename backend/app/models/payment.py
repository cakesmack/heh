"""
Payment model for tracking Stripe payments (Phase 2).
Handles featured event listings and subscription payments.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .user import User


class PaymentStatus(str, Enum):
    """Payment status states."""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class Payment(SQLModel, table=True):
    """
    Payment model for Stripe transactions.

    Attributes:
        id: Unique payment identifier
        user_id: User who made the payment
        event_id: Event being promoted (if applicable)
        stripe_payment_intent_id: Stripe payment intent ID
        amount: Payment amount in cents
        currency: Currency code (e.g., "gbp")
        status: Payment status
        description: Payment description
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    __tablename__ = "payments"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    event_id: Optional[str] = Field(default=None, index=True)  # If for event promotion

    # Stripe details
    stripe_payment_intent_id: str = Field(max_length=255, unique=True, index=True)

    # Payment details
    amount: int = Field(ge=0)  # Amount in cents
    currency: str = Field(default="gbp", max_length=3)
    status: PaymentStatus = Field(default=PaymentStatus.PENDING, index=True)

    # Description
    description: Optional[str] = Field(default=None, max_length=500)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: "User" = Relationship(back_populates="payments")
