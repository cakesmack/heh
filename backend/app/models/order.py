from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB

if TYPE_CHECKING:
    from .event import Event
    from .user import User
    from .ticket import Ticket

class Order(SQLModel, table=True):
    """
    Order model tracking ticket purchases for an event.
    """
    __tablename__ = "orders"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    
    order_ref: str = Field(max_length=12, unique=True, index=True, nullable=False)
    
    event_id: str = Field(
        sa_column=Column(String, ForeignKey("events.id"), index=True, nullable=False)
    )
    
    buyer_user_id: Optional[str] = Field(
        default=None,
        sa_column=Column(String, ForeignKey("users.id"), index=True, nullable=True)
    )
    
    buyer_email: str = Field(max_length=255, index=True, nullable=False)
    buyer_name: str = Field(max_length=255, nullable=False)
    buyer_phone: Optional[str] = Field(default=None, max_length=50)
    
    total_amount: float = Field(nullable=False, ge=0.0)
    platform_fee_amount: float = Field(default=0.0, ge=0.0)
    
    stripe_payment_intent_id: Optional[str] = Field(default=None, unique=True, index=True)
    
    status: str = Field(default="pending", index=True) # pending, completed, refunded, failed, cash_door_sale
    
    receipt_url: Optional[str] = Field(default=None, max_length=500)
    
    attendee_responses: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    event: "Event" = Relationship(back_populates="orders")
    tickets: List["Ticket"] = Relationship(back_populates="order", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
