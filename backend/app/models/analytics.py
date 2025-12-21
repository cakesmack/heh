from datetime import datetime
from typing import Optional, Dict, Any
from sqlmodel import Field, SQLModel, JSON

class AnalyticsEvent(SQLModel, table=True):
    __tablename__ = "analytics_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_type: str = Field(index=True)  # page_view, search, click_ticket, save_event
    user_id: Optional[str] = Field(default=None, index=True)
    session_id: str = Field(index=True)
    url: str
    event_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)
    created_at: datetime = Field(default_factory=datetime.utcnow)
