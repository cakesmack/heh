"""
Admin API for Accommodation Ads.
Handles CRUD operations with Cloudflare image uploads and interval overlap validation.
"""
import logging
from datetime import datetime, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlmodel import Session, select, and_, col
from pydantic import BaseModel

from app.core.database import get_session
from app.core.security import get_current_active_admin
from app.models.user import User
from app.models.accommodation_ad import AccommodationAd
from app.models.location import Location
from app.services.cloudflare_service import (
    is_cloudflare_configured,
    upload_to_cloudflare,
    get_cloudflare_url,
)

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_ADS_PER_LOCATION = 3


# --- Response Schemas ---

class AccommodationAdResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    destination_url: str
    image_url: str
    location_id: int
    location_name: Optional[str] = None
    start_date: date
    end_date: date
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Helper: Overlap Validation ---

def validate_no_overlap(
    session: Session,
    location_id: int,
    start_date: date,
    end_date: date,
    exclude_ad_id: Optional[int] = None,
) -> None:
    """
    Ensure a maximum of 3 ads can run concurrently for the same location
    during the proposed date range.

    Uses standard interval overlap: existing_start < new_end AND existing_end > new_start
    """
    query = (
        select(AccommodationAd)
        .where(AccommodationAd.location_id == location_id)
        .where(AccommodationAd.is_active == True)  # noqa: E712
        .where(AccommodationAd.start_date < end_date)
        .where(AccommodationAd.end_date > start_date)
    )

    if exclude_ad_id is not None:
        query = query.where(AccommodationAd.id != exclude_ad_id)

    overlapping_ads = session.exec(query).all()

    if len(overlapping_ads) >= MAX_ADS_PER_LOCATION:
        raise HTTPException(
            status_code=400,
            detail="Inventory full: Maximum of 3 ads already exist for this location during this timeframe.",
        )


def build_response(ad: AccommodationAd, location_name: Optional[str] = None) -> AccommodationAdResponse:
    """Build the API response with the joined location name."""
    return AccommodationAdResponse(
        id=ad.id,
        title=ad.title,
        description=ad.description,
        destination_url=ad.destination_url,
        image_url=ad.image_url,
        location_id=ad.location_id,
        location_name=location_name,
        start_date=ad.start_date,
        end_date=ad.end_date,
        is_active=ad.is_active,
        created_at=ad.created_at,
        updated_at=ad.updated_at,
    )


# --- Endpoints ---

@router.post("/accommodation", response_model=AccommodationAdResponse, status_code=status.HTTP_201_CREATED)
async def create_accommodation_ad(
    title: str = Form(...),
    destination_url: str = Form(...),
    location_id: int = Form(...),
    start_date: date = Form(...),
    end_date: date = Form(...),
    description: Optional[str] = Form(None),
    image: UploadFile = File(...),
    session: Session = Depends(get_session),
    admin: User = Depends(get_current_active_admin),
):
    """
    Create a new accommodation ad with Cloudflare image upload.
    Validates that no more than 3 ads overlap for the same location.
    """
    # 1. Basic date validation
    if end_date <= start_date:
        raise HTTPException(status_code=400, detail="end_date must be after start_date.")

    # 2. Verify location exists
    location = session.get(Location, location_id)
    if not location:
        raise HTTPException(status_code=404, detail=f"Location with id {location_id} not found.")

    # 3. Overlap validation (critical business rule)
    validate_no_overlap(session, location_id, start_date, end_date)

    # 4. Upload image to Cloudflare
    if not is_cloudflare_configured():
        raise HTTPException(status_code=500, detail="Cloudflare Images is not configured on this server.")

    image_id = await upload_to_cloudflare(image)
    image_url = image_id  # Store the Cloudflare image ID (consistent with media.py pattern)

    # 5. Create the ad record
    ad = AccommodationAd(
        title=title,
        description=description,
        destination_url=destination_url,
        image_url=image_url,
        location_id=location_id,
        start_date=start_date,
        end_date=end_date,
        is_active=True,
    )

    session.add(ad)
    session.commit()
    session.refresh(ad)

    logger.info(f"[ACCOMMODATION ADS] Admin {admin.id} created ad {ad.id} for location {location_id}")

    return build_response(ad, location_name=location.name)


@router.get("/accommodation", response_model=List[AccommodationAdResponse])
def list_accommodation_ads(
    location_id: Optional[int] = Query(None, description="Filter by location ID"),
    ad_status: Optional[str] = Query(None, alias="status", description="Filter: active, inactive, or expired"),
    session: Session = Depends(get_session),
    admin: User = Depends(get_current_active_admin),
):
    """
    List accommodation ads for the admin data table.
    Joins the locations table to include location_name in the response.
    Supports optional filters by location_id and status.
    """
    query = select(AccommodationAd, Location.name).outerjoin(
        Location, AccommodationAd.location_id == Location.id
    )

    # Filter by location
    if location_id is not None:
        query = query.where(AccommodationAd.location_id == location_id)

    # Filter by status
    today = date.today()
    if ad_status == "active":
        query = query.where(
            AccommodationAd.is_active == True,  # noqa: E712
            AccommodationAd.end_date >= today,
        )
    elif ad_status == "inactive":
        query = query.where(AccommodationAd.is_active == False)  # noqa: E712
    elif ad_status == "expired":
        query = query.where(
            AccommodationAd.end_date < today,
        )

    # Default ordering: newest first
    query = query.order_by(AccommodationAd.created_at.desc())

    results = session.exec(query).all()

    return [
        build_response(ad, location_name=loc_name)
        for ad, loc_name in results
    ]


@router.put("/accommodation/{ad_id}", response_model=AccommodationAdResponse)
async def update_accommodation_ad(
    ad_id: int,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    destination_url: Optional[str] = Form(None),
    location_id: Optional[int] = Form(None),
    start_date: Optional[date] = Form(None),
    end_date: Optional[date] = Form(None),
    is_active: Optional[bool] = Form(None),
    image: Optional[UploadFile] = File(None),
    session: Session = Depends(get_session),
    admin: User = Depends(get_current_active_admin),
):
    """
    Update an existing accommodation ad.
    Supports partial updates. Re-validates overlap if dates or location change.
    """
    ad = session.get(AccommodationAd, ad_id)
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found.")

    # Resolve effective values for overlap check
    effective_location = location_id if location_id is not None else ad.location_id
    effective_start = start_date if start_date is not None else ad.start_date
    effective_end = end_date if end_date is not None else ad.end_date

    if effective_end <= effective_start:
        raise HTTPException(status_code=400, detail="end_date must be after start_date.")

    # Verify location exists if changing it
    if location_id is not None:
        location = session.get(Location, location_id)
        if not location:
            raise HTTPException(status_code=404, detail=f"Location with id {location_id} not found.")

    # Re-validate overlap if dates or location changed
    dates_changed = start_date is not None or end_date is not None or location_id is not None
    if dates_changed:
        validate_no_overlap(session, effective_location, effective_start, effective_end, exclude_ad_id=ad.id)

    # Apply updates
    if title is not None:
        ad.title = title
    if description is not None:
        ad.description = description
    if destination_url is not None:
        ad.destination_url = destination_url
    if location_id is not None:
        ad.location_id = location_id
    if start_date is not None:
        ad.start_date = start_date
    if end_date is not None:
        ad.end_date = end_date
    if is_active is not None:
        ad.is_active = is_active

    # Handle optional image replacement
    if image is not None:
        if not is_cloudflare_configured():
            raise HTTPException(status_code=500, detail="Cloudflare Images is not configured on this server.")
        image_id = await upload_to_cloudflare(image)
        ad.image_url = image_id

    ad.updated_at = datetime.utcnow()
    session.add(ad)
    session.commit()
    session.refresh(ad)

    # Fetch location name for response
    location = session.get(Location, ad.location_id)
    loc_name = location.name if location else None

    logger.info(f"[ACCOMMODATION ADS] Admin {admin.id} updated ad {ad.id}")

    return build_response(ad, location_name=loc_name)


@router.delete("/accommodation/{ad_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_accommodation_ad(
    ad_id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(get_current_active_admin),
):
    """Delete an accommodation ad permanently."""
    ad = session.get(AccommodationAd, ad_id)
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found.")

    session.delete(ad)
    session.commit()

    logger.info(f"[ACCOMMODATION ADS] Admin {admin.id} deleted ad {ad_id}")
    return None



