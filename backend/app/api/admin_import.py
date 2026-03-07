"""
Admin API for importing single events.
Handles external image sideloading via Cloudflare Images and showtime parsing.
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
from app.models.venue import Venue
from app.models.showtime import EventShowtime
from app.services.cloudflare_service import is_cloudflare_configured, sideload_url_to_cloudflare, get_cloudflare_url
from app.services.event_service import upsert_event, cleanup_stale_venue_events

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
    organizer_profile_id: Optional[str] = None
    address: Optional[str] = None  # Full address string
    latitude: Optional[float] = None
    longitude: Optional[float] = None

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
                "raw_showtimes": ["Mon 12 Jan at 7:30", "Tue 13 Jan at 7:30"],
                "organizer_profile_id": "uuid-group-...",
                "address": "123 High St, Inverness",
                "latitude": 57.4778,
                "longitude": -4.2247
            }
        }


class VenueCleanupRequest(BaseModel):
    """Request body for post-import cleanup."""
    venue_id: str
    imported_event_ids: List[str]


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
async def import_single_event(
    req: SingleEventImportRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Import a single event from external data.
    Sideloads image from external URL to Cloudflare Images.
    Uses upsert logic: if an event with the same title + date + venue
    already exists, it is updated instead of duplicated.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    # 1. Image Processing (Sideload to Cloudflare Images)
    final_image_url = req.image_url
    
    if req.image_url and "imagedelivery.net" not in req.image_url:
        if not is_cloudflare_configured():
             raise HTTPException(status_code=500, detail="Cloudflare Images not configured")
        
        try:
            # Upload from remote URL via Cloudflare
            image_id = await sideload_url_to_cloudflare(req.image_url)
            final_image_url = get_cloudflare_url(image_id, "public")
        except Exception as e:
            # If upload fails, abort the import
            raise HTTPException(
                status_code=400, 
                detail=f"Image upload failed: {str(e)}"
            )

    # 2. Upsert Event (get-or-create)
    normalized_venue_id = normalize_uuid(req.venue_id) if req.venue_id else None

    # NEW: Dynamic Venue Matching
    if not normalized_venue_id and req.location_name:
        # Try to find a venue by exact or ilike match
        from sqlalchemy import func
        venue_match = session.exec(
            select(Venue).where(Venue.name.ilike(f"%{req.location_name}%"))
        ).first()
        if venue_match:
            normalized_venue_id = venue_match.id

    # Validate or Create Venue
    if normalized_venue_id:
        venue = session.get(Venue, normalized_venue_id)
        if not venue:
            # User expectation: Create venue if it doesn't exist, even if ID provided
            # This handles cases where frontend generated an ID or data is out of sync
            if not req.location_name and not req.address:
                 # We can't create a venue without at least a name
                 raise HTTPException(status_code=400, detail=f"Venue ID {normalized_venue_id} not found and no location name provided to create it.")
            
            venue = Venue(
                id=normalized_venue_id,
                name=req.location_name or "Unknown Venue",
                address=req.address,
                latitude=req.latitude,
                longitude=req.longitude,
                status="verified", # Auto-verify imported venues? Or keep properly?
                owner_id=current_user.id
            )
            session.add(venue)
            session.commit() # Commit immediately so FK exists for Event
            session.refresh(venue)

    # NEW: Strip "Copy of" prefix to prevent duplicates
    clean_title = req.title
    if clean_title.lower().startswith("copy of "):
        clean_title = clean_title[8:]

    event, created = upsert_event(
        session,
        title=clean_title,
        date_start=req.date_start,
        venue_id=normalized_venue_id,
        organizer_id=current_user.id,
        fields={
            "description": req.description,
            "date_end": req.date_end,
            "image_url": final_image_url,
            "ticket_url": req.ticket_url,
            "price_display": req.price_display,
            "min_price": req.min_price,
            "min_age": req.min_age,
            "category_id": normalize_uuid(req.category_id),
            "organizer_profile_id": normalize_uuid(req.organizer_profile_id) if req.organizer_profile_id else None,
            "location_name": req.location_name if not normalized_venue_id else None,
            "address_full": req.address,
            "latitude": req.latitude,
            "longitude": req.longitude,
        },
    )

    session.flush()  # Ensure event.id is available

    # 3. Sync Showtimes
    #    On update: clear old showtimes first, then re-insert.
    if not created:
        existing_showtimes = session.exec(
            select(EventShowtime).where(EventShowtime.event_id == event.id)
        ).all()
        for st in existing_showtimes:
            session.delete(st)

    year = req.date_start.year
    
    for showtime_str in req.raw_showtimes:
        try:
            st_dt = parse_showtime_string(showtime_str, year)
            showtime = EventShowtime(
                event_id=event.id,
                start_time=st_dt,
                ticket_url=req.ticket_url
            )
            session.add(showtime)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid showtime format '{showtime_str}': {str(e)}")

    session.commit()
    session.refresh(event)
    
    return {"success": True, "event_id": event.id, "created": created}


@router.post("/events/cleanup-venue")
def cleanup_venue_events(
    req: VenueCleanupRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Post-import cleanup: cancel future events for a venue that were NOT
    part of the latest scrape batch.

    Call this AFTER importing all events for a venue. Pass the venue_id
    and the list of event IDs returned by the import-single calls.

    Example workflow (scraper):
        1. For each event scraped → POST /events/import-single → collect event_id
        2. After all imports → POST /events/cleanup-venue with venue_id + all collected IDs
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    normalized_venue_id = normalize_uuid(req.venue_id)

    result = cleanup_stale_venue_events(
        session,
        venue_id=normalized_venue_id,
        current_import_ids=[normalize_uuid(eid) for eid in req.imported_event_ids],
    )

    session.commit()

    return {
        "success": True,
        "venue_id": normalized_venue_id,
        "cancelled_count": result["cancelled_count"],
        "cancelled_ids": result["cancelled_ids"],
    }
