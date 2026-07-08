from fastapi import APIRouter, Depends, Request
from sqlmodel import Session, select
from typing import List, Dict, Any
from app.db import get_session
from app.models.venue import Venue
from app.models.venue_category import VenueCategory

router = APIRouter()

@router.get("/venues", response_model=List[Dict[str, Any]])
def list_map_venues(
    request: Request,
    session: Session = Depends(get_session)
):
    """
    Get all verified venues for the map.
    """
    statement = (
        select(Venue, VenueCategory.name)
        .outerjoin(VenueCategory, Venue.category_id == VenueCategory.id)
        .filter(Venue.is_verified == True)
    )
    results = session.exec(statement).all()

    venues_list = []
    for venue, category_name in results:
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
        })

    return venues_list
