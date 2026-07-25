"""
PendingEvent model representing events scraped from external sources waiting for ingestion.
"""
from datetime import datetime
from typing import Optional, List
from uuid import uuid4
from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON

class PendingEvent(SQLModel, table=True):
    """
    Staging table for events scraped from external sources.
    """
    __tablename__ = "pending_events"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    title: str = Field(max_length=255, index=True)
    description: str = Field(max_length=20000)
    
    date_start: datetime = Field(index=True)
    date_end: Optional[datetime] = Field(default=None)
    
    image_url: Optional[str] = Field(default=None, max_length=500)
    ticket_url: Optional[str] = Field(default=None, max_length=500)
    website_url: Optional[str] = Field(default=None, max_length=500)
    
    price_display: Optional[str] = Field(default=None, max_length=100)
    min_price: Optional[float] = Field(default=None, ge=0.0)
    
    age_restriction: Optional[str] = Field(default=None, max_length=50)
    min_age: Optional[int] = Field(default=None)
    
    venue_name: str = Field(max_length=255)
    category_name: str = Field(max_length=255)
    source: str = Field(max_length=100, index=True)
    
    raw_showtimes: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    
    import_status: str = Field(default="pending", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
