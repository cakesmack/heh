"""
Admin API for importing single events.
Handles external image sideloading via Cloudinary and showtime parsing.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from uuid import uuid4
import re

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.utils import normalize_uuid
from app.models.user import User
from app.models.event import Event
from app.models.showtime import EventShowtime
from app.services.cloudinary_service import init_cloudinary, is_cloudinary_configured

# Define Router
router = APIRouter()

# Input Schema
class SingleEventImportRequest(BaseModel):
    title: str
    description: str
    date_start: datetime  # Pydantic parses ISO strings automatically
    date_end: Optional[datetime] = None
    image_url: str  # EXTERNAL URL
    ticket_url: Optional[str] = None
    price_display: str
    min_price: float
    min_age: int
    venue_id: Optional[str] = None
    location_name: Optional[str] = None
    category_id: str
    raw_showtimes: List[str] = []

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Hamlet",
                "description": "A tragedy...",
                "date_start": "2026-06-12T19:30:00",
                "date_end": "2026-06-12T22:00:00",
                "image_url": "https://external-site.com/poster.jpg",
                "ticket_url": "https://tickets.com/hamlet",
                "price_display": "From £15",
                "min_price": 15.00,
                "min_age": 12,
                "venue_id": "uuid-...",
                "category_id": "uuid-...",
                "raw_showtimes": ["Mon 12 Jan at 7:30", "Tue 13 Jan at 7:30"]
            }
        }


def parse_showtime_string(raw_str: str, year: int) -> datetime:
    """
    Parses "Mon 12 Jan at 7:30" + year into a datetime object.
    """
    # Regex: (DayName) (DayNum) (MonthName) at (Hour):(Minute)
    match = re.search(r"(\w+)\s+(\d+)\s+(\w+)\s+at\s+(\d+):(\d+)", raw_str)
    if not match:
        raise ValueError(f"Invalid format: {raw_str}")
    
    _, day_str, month_str, hour_str, minute_str = match.groups()
    
    # Map month name to number
    months = {
        "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
        "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
    }
    month = months.get(month_str[:3]) # Handle first 3 chars just in case
    if not month:
        raise ValueError(f"Invalid month: {month_str}")
        
    return datetime(year, month, int(day_str), int(hour_str), int(minute_str))


@router.post("/events/import-single", status_code=status.HTTP_201_CREATED)
def import_single_event(
    req: SingleEventImportRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Import a single event from external data.
    Sideloads image from external URL to Cloudinary.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    # 1. Duplicate Check
    # Check based on venue_id or location_name
    normalized_venue_id = normalize_uuid(req.venue_id) if req.venue_id else None
    
    if normalized_venue_id:
        # Venue-based duplicate check
        existing = session.exec(
            select(Event).where(
                Event.venue_id == normalized_venue_id,
                Event.title == req.title,
                Event.date_start == req.date_start
            )
        ).first()
    else:
        # Location-based duplicate check (custom location)
        existing = session.exec(
            select(Event).where(
                Event.location_name == req.location_name,
                Event.title == req.title,
                Event.date_start == req.date_start
            )
        ).first()
    
    if existing:
        return {"skipped": True, "reason": "duplicate", "event_id": existing.id}

    # 2. Image Processing (Sideload)
    final_image_url = req.image_url
    
    if req.image_url and "cloudinary" not in req.image_url:
        if not is_cloudinary_configured():
             raise HTTPException(status_code=500, detail="Cloudinary not configured")
        
        import cloudinary.uploader
        init_cloudinary()
        
        try:
            # Upload from remote URL
            upload_response = cloudinary.uploader.upload(
                req.image_url, 
                folder="highland_events/events"
            )
            final_image_url = upload_response.get("secure_url")
        except Exception as e:
            # If upload fails, abort the import
            raise HTTPException(
                status_code=400, 
                detail=f"Image upload failed: {str(e)}"
            )

    # 3. Create Event
    new_event = Event(
        id=normalize_uuid(uuid4()),
        title=req.title,
        description=req.description,
        date_start=req.date_start,
        date_end=req.date_end,
        venue_id=normalized_venue_id,  # Will be None for custom locations
        location_name=req.location_name if not normalized_venue_id else None,
        category_id=normalize_uuid(req.category_id),
        image_url=final_image_url,
        ticket_url=req.ticket_url,
        price_display=req.price_display,
        min_price=req.min_price,
        min_age=req.min_age,
        organizer_id=current_user.id,
        status="published"  # Admin imports are auto-published
    )
    
    session.add(new_event)
    session.flush() # Flush to get ID if needed, though we set it manually
    
    # 4. Parse & Save Showtimes
    year = req.date_start.year
    
    for showtime_str in req.raw_showtimes:
        try:
            st_dt = parse_showtime_string(showtime_str, year)
            
            # Create EventShowtime
            showtime = EventShowtime(
                event_id=new_event.id,
                start_time=st_dt,
                ticket_url=req.ticket_url # Inherit main ticket URL by default
            )
            session.add(showtime)
        except ValueError as e:
            # Log error but maybe continue? Or fail? 
            # Requirement says "Insert EventShowtime records". 
            # Strict failure is safer for API data integrity.
            raise HTTPException(status_code=400, detail=f"Invalid showtime format '{showtime_str}': {str(e)}")

    session.commit()
    session.refresh(new_event)
    
    return {"success": True, "event_id": new_event.id}
