from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, String, ForeignKey

if TYPE_CHECKING:
    from .event import Event
    from .ticket_tier import TicketTier

class PromoCode(SQLModel, table=True):
    """
    Promo Code definition for discounting event tickets or unlocking hidden tiers.
    """
    __tablename__ = "promo_codes"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    
    event_id: str = Field(
        sa_column=Column(String, ForeignKey("events.id", ondelete="CASCADE"), index=True, nullable=False)
    )
    
    code_text: str = Field(max_length=50, index=True, nullable=False)
    discount_type: str = Field(nullable=False) # 'percentage' or 'fixed_amount'
    discount_value: float = Field(nullable=False, ge=0.0)
    
    usage_limit: Optional[int] = Field(default=None, ge=1)
    usage_count: int = Field(default=0, nullable=False, ge=0)
    
    valid_from: Optional[datetime] = Field(default=None)
    valid_until: Optional[datetime] = Field(default=None)
    
    target_tier_id: Optional[str] = Field(
        default=None,
        sa_column=Column(String, ForeignKey("ticket_tiers.id", ondelete="SET NULL"), nullable=True)
    )
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    event: "Event" = Relationship(back_populates="promo_codes")
    target_tier: Optional["TicketTier"] = Relationship(back_populates="promo_codes")
