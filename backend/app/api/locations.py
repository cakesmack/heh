"""
API routes for Geographic Hub (Location) management.
GET /api/locations — Public list of all geographic hubs.
GET /api/locations/feed/{location_slug}/{timeframe?} — Public location events feed with SEO timeframe sub-routes.
PUT /api/locations/:id — Admin-only update of a specific hub's SEO/hero fields.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, or_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import selectinload

import re
from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.location import Location
from app.models.event import Event
from app.models.venue import Venue
from app.schemas.event import EventResponse

router = APIRouter(tags=["Locations"])


def slugify(text: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9\s-]', '', text).strip().lower()
    return re.sub(r'[\s_-]+', '-', cleaned)


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that requires admin privileges."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# ============================================================
# SCHEMAS
# ============================================================

class LocationResponse(BaseModel):
    id: int
    name: str
    slug: str
    seo_meta_title: Optional[str] = None
    seo_meta_description: Optional[str] = None
    seo_anchor_text: Optional[str] = None
    hero_image_url: Optional[str] = None
    featured_event_id: Optional[str] = None
    partner_logo: Optional[str] = None
    partner_url: Optional[str] = None
    partner_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LocationCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    seo_meta_title: Optional[str] = None
    seo_meta_description: Optional[str] = None
    seo_anchor_text: Optional[str] = None
    hero_image_url: Optional[str] = None
    featured_event_id: Optional[str] = None
    partner_logo: Optional[str] = None
    partner_url: Optional[str] = None
    partner_name: Optional[str] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    seo_meta_title: Optional[str] = None
    seo_meta_description: Optional[str] = None
    seo_anchor_text: Optional[str] = None
    hero_image_url: Optional[str] = None
    featured_event_id: Optional[str] = None
    partner_logo: Optional[str] = None
    partner_url: Optional[str] = None
    partner_name: Optional[str] = None


class LocationFeedResponse(BaseModel):
    location_name: str
    location_slug: str
    timeframe: str
    meta_title: str
    meta_description: str
    h1_heading: str
    hero_image_url: Optional[str] = None
    seo_anchor_text: Optional[str] = None
    partner_logo: Optional[str] = None
    partner_url: Optional[str] = None
    partner_name: Optional[str] = None
    is_fallback: bool = False
    fallback_notice: Optional[str] = None
    events: List[EventResponse]


# ============================================================
# ROUTES
# ============================================================

@router.get("", response_model=List[LocationResponse])
def list_locations(
    category_slug: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """List all geographic hubs. Public endpoint."""
    query = select(Location)
    locations = session.exec(query.order_by(Location.name.asc())).all()
    return locations


@router.get("/feed/{location_slug}", response_model=LocationFeedResponse)
@router.get("/feed/{location_slug}/{timeframe}", response_model=LocationFeedResponse)
def get_location_feed(
    location_slug: str,
    timeframe: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """
    Public feed for Location hub pages supporting timeframe sub-routes:
    - Default (All Upcoming)
    - /today (Today's calendar window)
    - /this-weekend (Friday 16:00 to Sunday 23:59:59 window)
    Includes SEO metadata and thin content / empty state fallback handling.
    """
    slug = location_slug.lower().strip().strip('/')
    city_name = slug.replace("-", " ")
    formatted_name = city_name.title()

    # Look up location metadata
    location_record = session.exec(
        select(Location).where(Location.slug == slug)
    ).first()

    if location_record and location_record.name:
        formatted_name = location_record.name

    now = datetime.utcnow()
    tf = (timeframe or "all").lower().strip()

    is_fallback = False
    fallback_notice = None

    # Determine timeframe window & metadata strings
    if tf == "today":
        timeframe_key = "today"
        start_bound = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_bound = now.replace(hour=23, minute=59, second=59, microsecond=999999)

        meta_title = f"What's On in {formatted_name} Today | Gigs & Events Guide"
        meta_description = f"Discover live music, theater, and things to do in {formatted_name} today. View today's full schedule of local events."
        h1_heading = f"What's On in {formatted_name} Today"

    elif tf in ["this-weekend", "weekend"]:
        timeframe_key = "this-weekend"
        weekday = now.weekday()  # Mon=0 ... Sun=6

        if weekday <= 4:
            friday_date = (now + timedelta(days=(4 - weekday))).date()
            start_bound = datetime.combine(friday_date, datetime.min.time()).replace(hour=16)
            sunday_date = (now + timedelta(days=(6 - weekday))).date()
            end_bound = datetime.combine(sunday_date, datetime.max.time())
        else:
            friday_date = (now - timedelta(days=(weekday - 4))).date()
            start_bound = datetime.combine(friday_date, datetime.min.time()).replace(hour=16)
            sunday_date = (now + timedelta(days=(6 - weekday))).date()
            end_bound = datetime.combine(sunday_date, datetime.max.time())

        meta_title = f"What's On in {formatted_name} This Weekend | Local Events & Gigs"
        meta_description = f"Looking for things to do in {formatted_name} this weekend? View the full calendar of weekend gigs, family activities, and local events."
        h1_heading = f"What's On in {formatted_name} This Weekend"

    else:
        timeframe_key = "all"
        start_bound = now
        end_bound = None

        meta_title = (location_record and location_record.seo_meta_title) or f"Events & Things to Do in {formatted_name} | Highland Events Hub"
        meta_description = (location_record and location_record.seo_meta_description) or f"Find out what's on in {formatted_name}, Scottish Highlands. Live music, festivals, community events, and things to do."
        h1_heading = f"Events & Things to Do in {formatted_name}"

    # Build query for published events matching location & timeframe
    term = f"%{city_name}%"
    base_query = (
        select(Event)
        .options(selectinload(Event.category_rel), selectinload(Event.venue))
        .outerjoin(Venue, Event.venue_id == Venue.id)
        .where(Event.status == "published", Event.is_cancelled == False)
        .where(
            or_(
                Event.location_name.ilike(term),
                Event.postcode.ilike(term),
                Venue.city.ilike(term),
                Venue.address.ilike(term)
            )
        )
    )

    query = base_query.where(Event.date_start >= start_bound)
    if end_bound:
        query = query.where(Event.date_start <= end_bound)

    query = query.order_by(Event.date_start.asc())
    events = session.exec(query.limit(200)).all()

    # Thin Content / Empty State Protection
    if len(events) == 0 and timeframe_key in ["today", "this-weekend"]:
        is_fallback = True
        time_label = "today" if timeframe_key == "today" else "this weekend"
        fallback_notice = f"No events scheduled in {formatted_name} for {time_label}. Here are the next upcoming events in {formatted_name}:"
        
        fallback_query = (
            base_query
            .where(Event.date_start >= now)
            .order_by(Event.date_start.asc())
            .limit(5)
        )
        events = session.exec(fallback_query).all()

    hero_image_url = location_record.hero_image_url if location_record else None
    anchor_text = location_record.seo_anchor_text if location_record else None
    partner_logo = location_record.partner_logo if location_record else None
    partner_url = location_record.partner_url if location_record else None
    partner_name = location_record.partner_name if location_record else None

    return LocationFeedResponse(
        location_name=formatted_name,
        location_slug=slug,
        timeframe=timeframe_key,
        meta_title=meta_title,
        meta_description=meta_description,
        h1_heading=h1_heading,
        hero_image_url=hero_image_url,
        seo_anchor_text=anchor_text,
        partner_logo=partner_logo,
        partner_url=partner_url,
        partner_name=partner_name,
        is_fallback=is_fallback,
        fallback_notice=fallback_notice,
        events=[EventResponse.model_validate(e) for e in events]
    )


@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def create_location(
    data: LocationCreate,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Create a new geographic location hub. Admin-only."""
    if not data.name or not data.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Location name is required"
        )

    raw_slug = data.slug.strip() if data.slug and data.slug.strip() else data.name.strip()
    slug = slugify(raw_slug)

    if not slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid location slug is required"
        )

    # Check for slug conflict
    existing = session.exec(select(Location).where(Location.slug == slug)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A location with slug '{slug}' already exists."
        )

    location = Location(
        name=data.name.strip(),
        slug=slug,
        seo_meta_title=data.seo_meta_title or None,
        seo_meta_description=data.seo_meta_description or None,
        seo_anchor_text=data.seo_anchor_text or None,
        hero_image_url=data.hero_image_url or None,
        featured_event_id=data.featured_event_id or None,
        partner_logo=data.partner_logo or None,
        partner_url=data.partner_url or None,
        partner_name=data.partner_name or None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(location)
    session.commit()
    session.refresh(location)
    return location


@router.get("/{location_id}", response_model=LocationResponse)
def get_location(
    location_id: int,
    session: Session = Depends(get_session)
):
    """Get a single geographic hub by ID. Public endpoint."""
    location = session.get(Location, location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )
    return location


@router.put("/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: int,
    data: LocationUpdate,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Update a geographic hub's fields. Admin-only."""
    location = session.get(Location, location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"]:
        location.name = update_data["name"].strip()

    if "slug" in update_data and update_data["slug"]:
        new_slug = slugify(update_data["slug"].strip())
        if new_slug and new_slug != location.slug:
            existing = session.exec(select(Location).where(Location.slug == new_slug, Location.id != location_id)).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A location with slug '{new_slug}' already exists."
                )
            location.slug = new_slug

    for field in [
        "seo_meta_title", "seo_meta_description", "seo_anchor_text",
        "hero_image_url", "featured_event_id", "partner_logo",
        "partner_url", "partner_name"
    ]:
        if field in update_data:
            setattr(location, field, update_data[field])

    location.updated_at = datetime.utcnow()
    session.add(location)
    session.commit()
    session.refresh(location)

    return location


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    location_id: int,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Delete a geographic location hub. Admin-only."""
    location = session.get(Location, location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    session.delete(location)
    session.commit()
    return None
