from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, String, ForeignKey

if TYPE_CHECKING:
    from .organizer import Organizer

class OrganizerStripeAccount(SQLModel, table=True):
    """
    Stripe Account connection for an Organizer to accept payments and payouts.
    """
    __tablename__ = "organizer_stripe_accounts"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    
    organizer_profile_id: str = Field(
        sa_column=Column(
            String, 
            ForeignKey("organizers.id", ondelete="CASCADE"), 
            unique=True, 
            index=True, 
            nullable=False
        )
    )
    
    stripe_account_id: str = Field(unique=True, index=True, max_length=255)
    
    charges_enabled: bool = Field(default=False)
    payouts_enabled: bool = Field(default=False)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    organizer: "Organizer" = Relationship(back_populates="stripe_account")
