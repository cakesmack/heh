from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class PendingEventCreate(BaseModel):
    title: str
    description: str
    date_start: datetime
    date_end: Optional[datetime] = None
    image_url: Optional[str] = None
    ticket_url: Optional[str] = None
    price_display: Optional[str] = None
    min_price: Optional[float] = None
    age_restriction: Optional[str] = None
    min_age: Optional[int] = None
    venue_name: str
    category_name: str
    source: str
    raw_showtimes: List[str] = []
