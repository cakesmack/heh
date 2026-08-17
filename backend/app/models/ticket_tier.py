from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, String, ForeignKey

if TYPE_CHECKING:
    from .event import Event
    from .ticket import Ticket
    from .promo_code import PromoCode

class TicketTier(SQLModel, table=True):
    """
    Ticket Tier definition for an Event (e.g., General Admission, VIP, Early Bird).
    """
    __tablename__ = "ticket_tiers"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    
    event_id: str = Field(
        sa_column=Column(String, ForeignKey("events.id", ondelete="CASCADE"), index=True, nullable=False)
    )
    
    name: str = Field(max_length=100, nullable=False)
    price: float = Field(default=0.0, ge=0.0)
    
    quantity_available: int = Field(nullable=False, ge=0)
    quantity_sold: int = Field(default=0, nullable=False, ge=0)
    max_per_order: int = Field(default=6, ge=1)
    
    sale_start: Optional[datetime] = Field(default=None)
    sale_end: Optional[datetime] = Field(default=None)
    
    is_hidden: bool = Field(default=False)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    event: "Event" = Relationship(back_populates="ticket_tiers")
    tickets: List["Ticket"] = Relationship(back_populates="tier", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    promo_codes: List["PromoCode"] = Relationship(back_populates="target_tier")
