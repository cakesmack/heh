"""
API routes for Geographic Hub (Location) management.
GET /api/locations — Public list of all geographic hubs.
PUT /api/locations/:id — Admin-only update of a specific hub's SEO/hero fields.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.location import Location

router = APIRouter(tags=["Locations"])


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
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LocationUpdate(BaseModel):
    seo_meta_title: Optional[str] = None
    seo_meta_description: Optional[str] = None
    seo_anchor_text: Optional[str] = None
    hero_image_url: Optional[str] = None
    featured_event_id: Optional[str] = None


# ============================================================
# ROUTES
# ============================================================

@router.get("", response_model=List[LocationResponse])
def list_locations(
    category_slug: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """List all geographic hubs. Public endpoint with optional category filtering."""
    from app.models.event import Event
    from app.models.venue import Venue
    from app.models.category import Category
    from sqlalchemy import func, or_

    query = select(Location).distinct()

    # Join Event based on location name mapping
    query = query.join(
        Event,
        or_(
            Event.location_name.ilike(func.concat('%', Location.name, '%')),
            Event.venue_id.in_(
                select(Venue.id).where(
                    or_(
                        Venue.address.ilike(func.concat('%', Location.name, '%')),
                        Venue.formatted_address.ilike(func.concat('%', Location.name, '%')),
                        Venue.name.ilike(func.concat('%', Location.name, '%'))
                    )
                )
            )
        )
    )

    # Active, published events only (start_date >= now)
    query = query.where(Event.status == "published")
    query = query.where(Event.date_start >= func.now())

    # Filter by category if category_slug is provided
    if category_slug:
        query = query.join(Category, Event.category_id == Category.id)
        query = query.where(Category.slug == category_slug)

    locations = session.exec(query.order_by(Location.name.asc())).all()
    return locations


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
    """Update a geographic hub's SEO/hero fields. Admin-only."""
    location = session.get(Location, location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(location, field, value)

    location.updated_at = datetime.utcnow()
    session.add(location)
    session.commit()
    session.refresh(location)

    return location
