"""
Campaign Log model for tracking email campaign sends.
Provides audit trail and failure tracking for bulk email operations.
"""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class CampaignLog(SQLModel, table=True):
    """
    Tracks individual email sends within a campaign batch.
    Allows resuming failed batches and auditing delivery.
    """
    __tablename__ = "campaign_logs"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Campaign identification
    campaign_id: str = Field(index=True, max_length=50)  # Shared UUID for all emails in one batch
    subject: str = Field(max_length=500)

    # Recipient
    user_id: str = Field(index=True, max_length=100)
    email: str = Field(max_length=255)

    # Status: 'sent', 'failed', 'pending'
    status: str = Field(default="pending", index=True, max_length=20)
    error_message: Optional[str] = Field(default=None, max_length=2000)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    sent_at: Optional[datetime] = Field(default=None)
