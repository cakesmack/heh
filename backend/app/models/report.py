from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel

class Report(SQLModel, table=True):
    __tablename__ = "reports"

    id: Optional[int] = Field(default=None, primary_key=True)
    target_type: str = Field(index=True)  # "event" or "venue"
    target_id: str = Field(index=True)
    reason: str
    details: Optional[str] = None
    status: str = Field(default="pending")  # pending, resolved, dismissed
    reporter_id: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
