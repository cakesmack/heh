"""
Public API for Accommodation Ads.
Allows fetching active ads for location pages and widgets.
"""
from datetime import date
from typing import List
from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.accommodation_ad import AccommodationAd
from app.models.location import Location
from app.api.accommodation_ads import AccommodationAdResponse, build_response

router = APIRouter()


@router.get("/accommodation/location/{location_id}", response_model=List[AccommodationAdResponse])
def get_public_ads_for_location(
    location_id: int,
    session: Session = Depends(get_session),
):
    """
    Public endpoint: Get all currently active ads for a specific location.
    Returns only ads where today falls within the start/end date range and is_active is True.
    """
    today = date.today()

    query = (
        select(AccommodationAd, Location.name)
        .outerjoin(Location, AccommodationAd.location_id == Location.id)
        .where(AccommodationAd.location_id == location_id)
        .where(AccommodationAd.is_active == True)  # noqa: E712
        .where(AccommodationAd.start_date <= today)
        .where(AccommodationAd.end_date >= today)
        .order_by(AccommodationAd.created_at.desc())
    )

    results = session.exec(query).all()

    return [
        build_response(ad, location_name=loc_name)
        for ad, loc_name in results
    ]
