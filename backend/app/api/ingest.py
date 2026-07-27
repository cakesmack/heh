import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlmodel import Session, select
from sqlalchemy import func
from dotenv import load_dotenv

from app.core.database import get_session
from app.models.pending_event import PendingEvent
from app.models.event import Event
from app.schemas.pending_event import PendingEventCreate

from app.core.utils import to_london_naive

load_dotenv()

router = APIRouter()

def verify_scraper_key(x_scraper_api_key: str = Header(...)):
    expected_key = os.getenv("SCRAPER_API_KEY")
    if not expected_key or x_scraper_api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing Scraper API Key",
        )
    return x_scraper_api_key

@router.post("/events", response_model=dict)
def ingest_events(
    events: List[PendingEventCreate],
    session: Session = Depends(get_session),
    api_key: str = Depends(verify_scraper_key)
):
    """
    Bulk ingest scraped events into the pending_events staging table.
    Filters out duplicates that match normalized title and date in either Event or PendingEvent tables.
    """
    count = 0
    dropped = 0
    for event_data in events:
        if not event_data.title or not event_data.date_start:
            # Skip invalid events
            dropped += 1
            continue

        normalized_title = event_data.title.strip().lower()
        event_date = event_data.date_start.date() if hasattr(event_data.date_start, 'date') else event_data.date_start

        # Check LiveEvents (Event)
        live_duplicate = session.exec(
            select(Event).where(
                func.lower(func.trim(Event.title)) == normalized_title,
                func.date(Event.date_start) == event_date
            )
        ).first()

        if live_duplicate:
            dropped += 1
            continue

        # Check PendingEvents
        pending_duplicate = session.exec(
            select(PendingEvent).where(
                func.lower(func.trim(PendingEvent.title)) == normalized_title,
                func.date(PendingEvent.date_start) == event_date
            )
        ).first()

        if pending_duplicate:
            dropped += 1
            continue

        dumped = event_data.model_dump()
        dumped["date_start"] = to_london_naive(dumped.get("date_start"))
        if dumped.get("date_end"):
            dumped["date_end"] = to_london_naive(dumped.get("date_end"))
        if dumped.get("recurrence_end_date"):
            dumped["recurrence_end_date"] = to_london_naive(dumped.get("recurrence_end_date"))

        db_event = PendingEvent(
            **dumped,
            import_status="pending"
        )
        session.add(db_event)
        count += 1
        
    session.commit()
    
    return {"message": f"Successfully ingested {count} events, dropped {dropped} duplicates.", "count": count, "dropped": dropped}

