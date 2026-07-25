import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlmodel import Session
from dotenv import load_dotenv

from app.core.database import get_session
from app.models.pending_event import PendingEvent
from app.schemas.pending_event import PendingEventCreate

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
    """
    count = 0
    for event_data in events:
        db_event = PendingEvent(
            **event_data.model_dump(),
            import_status="pending"
        )
        session.add(db_event)
        count += 1
        
    session.commit()
    
    return {"message": f"Successfully ingested {count} events", "count": count}
