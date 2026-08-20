from fastapi import APIRouter, Depends, Request
from sqlmodel import Session, select, func
from typing import List, Dict, Any
from datetime import datetime
from app.core.database import get_session
from app.models.venue import Venue
from app.models.venue_category import VenueCategory
from app.models.event import Event

router = APIRouter()

@router.get("/venues", response_model=List[Dict[str, Any]])
def list_map_venues(
    request: Request,
    session: Session = Depends(get_session)
):
    """
    Get all verified venues for the map.
    """
    today = datetime.utcnow()
    event_subquery = (
        select(Event.venue_id, func.count(Event.id).label("upcoming_count"))
        .where(Event.date_end >= today)
        .where(Event.status == "published")
        .where(Event.is_cancelled == False)
        .group_by(Event.venue_id)
        .subquery()
    )

    statement = (
        select(Venue, VenueCategory.name, func.coalesce(event_subquery.c.upcoming_count, 0).label("event_count"))
        .outerjoin(VenueCategory, Venue.category_id == VenueCategory.id)
        .outerjoin(event_subquery, Venue.id == event_subquery.c.venue_id)
        .filter(Venue.is_verified == True)
    )
    results = session.exec(statement).all()

    venues_list = []
    for venue, category_name, event_count in results:
        first_image = None
        if venue.image_url:
            images = [img.strip() for img in venue.image_url.split(",") if img.strip()]
            if images:
                first_image = images[0]

        venues_list.append({
            "id": venue.id,
            "slug": venue.slug or venue.id,
            "name": venue.name,
            "latitude": venue.latitude,
            "longitude": venue.longitude,
            "venue_type": category_name or "Venue",
            "image_url": first_image,
            "event_count": event_count,
        })

    return venues_list
