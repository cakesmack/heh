from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, String, ForeignKey

if TYPE_CHECKING:
    from .order import Order
    from .ticket_tier import TicketTier

class Ticket(SQLModel, table=True):
    """
    Ticket model representing individual tickets bought as part of an Order.
    """
    __tablename__ = "tickets"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    
    order_id: str = Field(
        sa_column=Column(String, ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False)
    )
    
    tier_id: str = Field(
        sa_column=Column(String, ForeignKey("ticket_tiers.id"), index=True, nullable=False)
    )
    
    qr_token: str = Field(max_length=64, unique=True, index=True, nullable=False)
    
    status: str = Field(default="valid", index=True) # valid, checked_in, refunded
    
    checked_in_at: Optional[datetime] = Field(default=None)
    checked_in_by: Optional[str] = Field(default=None, max_length=255)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    order: "Order" = Relationship(back_populates="tickets")
    tier: "TicketTier" = Relationship(back_populates="tickets")
