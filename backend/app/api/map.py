from fastapi import APIRouter, Depends, Request, Query
from sqlmodel import Session, select, func
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.core.database import get_session
from app.models.venue import Venue
from app.models.venue_category import VenueCategory
from app.models.event import Event
from app.schemas.event import MapEventResponse
from app.core.limiter import limiter

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


@router.get("/events", response_model=List[MapEventResponse])
@limiter.limit("60/minute")
def list_map_events(
    request: Request,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    category_id: Optional[str] = None,
    collection_id: Optional[str] = Query(None, description="Filter by collection ID or slug"),
    latitude: Optional[float] = Query(None, description="User latitude"),
    longitude: Optional[float] = Query(None, description="User longitude"),
    radius_miles: Optional[float] = Query(None, alias="radius", description="Search radius in miles"),
    q: Optional[str] = Query(None, description="Search keyword"),
    session: Session = Depends(get_session)
):
    """
    Supply event data to interactive map (alias matching GET /api/map/events).
    Enforces strict organizer_profile_ids boundary when collection_id is provided.
    """
    from app.api.events import list_events_map
    return list_events_map(
        request=request,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        collection_id=collection_id,
        latitude=latitude,
        longitude=longitude,
        radius_miles=radius_miles,
        q=q,
        session=session
    )
