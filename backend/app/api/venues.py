"""
Venues API routes.
Handles venue CRUD operations and filtering.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlmodel import Session, select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_session
from app.core.limiter import limiter
from app.core.security import get_current_user
from app.core.utils import normalize_uuid
from app.models.user import User
from app.models.venue import Venue, VenueStatus
from app.models.venue_category import VenueCategory
from app.models.event import Event
from app.models.venue_claim import VenueClaim
from app.models.venue_invite import VenueInvite
from app.models.venue_staff import VenueStaff, VenueRole
from app.schemas.venue_claim import VenueClaimCreate, VenueClaimResponse
from app.schemas.venue import (
    VenueCreate,
    VenueUpdate,
    VenueResponse,
    VenueFilter,
    VenueListResponse,
    VenueCategoryResponse,
    VenueCategoryCreate,
    VenueCategoryUpdate,
    VenueStaffCreate,
    VenueStaffResponse,
    VenueStatsResponse
)
from app.schemas.event import EventListResponse, EventResponse
from app.services.geolocation import calculate_geohash, haversine_distance, get_bounding_box
from app.utils.validators import validate_url, validate_phone

router = APIRouter(tags=["Venues"])

# Scottish Highlands & Islands bounding box
HIGHLANDS_BOUNDS = {
    "south": 55.6,   # North of Glasgow
    "north": 59.5,   # Including Orkney/Shetland
    "west": -8.0,    # Outer Hebrides
    "east": -2.0,    # East Coast
}


def is_within_highlands(latitude: float, longitude: float) -> bool:
    """Check if coordinates fall within the Highlands & Islands region."""
    return (
        HIGHLANDS_BOUNDS["south"] <= latitude <= HIGHLANDS_BOUNDS["north"] and
        HIGHLANDS_BOUNDS["west"] <= longitude <= HIGHLANDS_BOUNDS["east"]
    )


def build_venue_response(venue: Venue, session: Session, latitude: float = None, longitude: float = None) -> VenueResponse:
    """Build VenueResponse with computed fields."""
    # Calculate distance if coordinates provided
    distance_km = None
    if latitude is not None and longitude is not None:
        distance_km = haversine_distance(latitude, longitude, venue.latitude, venue.longitude)

    # Count upcoming events
    upcoming_events_count = session.exec(
        select(func.count(Event.id))
        .where(Event.venue_id == venue.id)
        .where(Event.date_start >= func.now())
    ).one()

    response = VenueResponse.model_validate(venue)
    response.distance_km = distance_km
    response.upcoming_events_count = upcoming_events_count
    
    # Populate owner email for admin
    if venue.owner:
        response.owner_email = venue.owner.email
        
    return response


def check_venue_permission(venue: Venue, user: User, session: Session, min_role: VenueRole = VenueRole.STAFF) -> bool:
    """Check if user has permission to manage a venue."""
    if user.is_admin:
        return True
    if venue.owner_id == user.id:
        return True
    
    # Check staff roles
    staff = session.exec(
        select(VenueStaff).where(VenueStaff.venue_id == venue.id, VenueStaff.user_id == user.id)
    ).first()
    
    if not staff:
        return False
    
    if min_role == VenueRole.MANAGER:
        return staff.role == VenueRole.MANAGER
    
    return True


@router.get("/categories", response_model=list[VenueCategoryResponse])
def list_venue_categories(session: Session = Depends(get_session)):
    """
    List all available venue categories.
    """
    categories = session.exec(select(VenueCategory).order_by(VenueCategory.name)).all()
    return categories


@router.post("/categories", response_model=VenueCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_venue_category(
    category_data: VenueCategoryCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Create a new venue category.
    Only admins can create categories.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Check for existing slug
    existing = session.exec(select(VenueCategory).where(VenueCategory.slug == category_data.slug)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category with this slug already exists")

    new_category = VenueCategory.model_validate(category_data)
    session.add(new_category)
    session.commit()
    session.refresh(new_category)
    return new_category


@router.put("/categories/{category_id}", response_model=VenueCategoryResponse)
def update_venue_category(
    category_id: str,
    category_data: VenueCategoryUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Update a venue category.
    Only admins can update categories.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    category = session.get(VenueCategory, category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    if category_data.slug and category_data.slug != category.slug:
        existing = session.exec(select(VenueCategory).where(VenueCategory.slug == category_data.slug)).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category with this slug already exists")

    update_data = category_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)

    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_venue_category(
    category_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Delete a venue category.
    Only admins can delete categories.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    category = session.get(VenueCategory, category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    # Check if used by any venues
    venue_count = session.exec(select(func.count(Venue.id)).where(Venue.category_id == category_id)).one()
    if venue_count > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot delete category used by {venue_count} venues")

    session.delete(category)
    session.commit()
    return None


@router.get("/search", response_model=VenueListResponse)
def search_venues(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    postcode: Optional[str] = Query(None, max_length=10),
    limit: int = Query(default=10, ge=1, le=50),
    session: Session = Depends(get_session)
):
    """
    Search venues by name, address, or postcode.

    Used for venue typeahead in event forms.
    Returns matching venues sorted by relevance.
    """
    search_term = f"%{q.lower()}%"

    query = select(Venue).outerjoin(VenueCategory, Venue.category_id == VenueCategory.id).where(
        (Venue.name.ilike(search_term)) |
        (Venue.address.ilike(search_term)) |
        (Venue.formatted_address.ilike(search_term)) |
        (VenueCategory.name.ilike(search_term))
    )

    # Additional postcode filter
    if postcode:
        postcode_term = f"%{postcode.upper()}%"
        query = query.where(Venue.postcode.ilike(postcode_term))

    query = query.order_by(Venue.name).limit(limit)
    venues = session.exec(query).all()

    venue_responses = [
        build_venue_response(venue, session)
        for venue in venues
    ]

    return VenueListResponse(
        venues=venue_responses,
        total=len(venue_responses),
        skip=0,
        limit=limit
    )


@router.get("", response_model=VenueListResponse)
@limiter.limit("100/minute")
def list_venues(
    request: Request,
    category_id: Optional[str] = None,
    owner_id: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: Optional[float] = None,
    sort_by: Optional[str] = Query(None, description="Sort order: 'activity' (future events count) or 'name' (default A-Z)"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=1000),
    session: Session = Depends(get_session)
):
    """
    List venues with optional filtering.

    Supports filtering by:
    - Category ID
    - Category
    - Geographic proximity (latitude, longitude, radius)
    
    Supports sorting by:
    - name (default): Alphabetical A-Z
    - activity: By count of future events (most active first)
    """
    # Build base query
    if sort_by == "activity":
        # Subquery to count future events per venue
        future_events_count = (
            select(func.count(Event.id))
            .where(Event.venue_id == Venue.id)
            .where(Event.date_start >= func.now())
            .correlate(Venue)
            .scalar_subquery()
        )
        query = select(Venue).add_columns(future_events_count.label("event_count"))
    else:
        query = select(Venue)

    # Filter by category
    if category_id:
        query = query.where(Venue.category_id == category_id)

    # Filter by owner
    if owner_id:
        query = query.where(Venue.owner_id == owner_id)

    # Filter by geographic proximity
    if latitude is not None and longitude is not None and radius_km is not None:
        min_lat, max_lat, min_lon, max_lon = get_bounding_box(latitude, longitude, radius_km)
        query = query.where(
            Venue.latitude.between(min_lat, max_lat),
            Venue.longitude.between(min_lon, max_lon)
        )

    # Apply sorting
    if sort_by == "activity":
        query = query.order_by(future_events_count.desc(), Venue.name)
    else:
        query = query.order_by(Venue.name)

    # Count total (need to handle subquery differently for activity sort)
    if sort_by == "activity":
        count_query = select(func.count()).select_from(
            select(Venue.id).where(
                (Venue.category_id == category_id) if category_id else True
            ).subquery()
        )
        total = session.exec(count_query).one()
    else:
        total = session.exec(select(func.count()).select_from(query.subquery())).one()

    # Apply pagination
    query = query.offset(skip).limit(limit)
    results = session.exec(query).all()
    
    # Extract venues from results (handle tuple for activity sort)
    if sort_by == "activity":
        venues = [result[0] if isinstance(result, tuple) else result for result in results]
    else:
        venues = results

    # Build response with computed fields
    venue_responses = [
        build_venue_response(venue, session, latitude, longitude)
        for venue in venues
    ]

    return VenueListResponse(
        venues=venue_responses,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("", response_model=VenueResponse, status_code=status.HTTP_201_CREATED)
def create_venue(
    venue_data: VenueCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Create a new venue.

    Requires authentication. User becomes the venue owner.
    """
    # Validate optional fields
    if venue_data.website:
        url_valid, url_error = validate_url(venue_data.website)
        if not url_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=url_error
            )

    if venue_data.phone:
        phone_valid, phone_error = validate_phone(venue_data.phone)
        if not phone_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=phone_error
            )

    # Validate venue is within Highlands & Islands region
    if not is_within_highlands(venue_data.latitude, venue_data.longitude):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Venues must be located within the Highlands & Islands region."
        )

    # Calculate geohash
    geohash = calculate_geohash(venue_data.latitude, venue_data.longitude)

    geohash = calculate_geohash(venue_data.latitude, venue_data.longitude)

    # Status Logic
    # Admins can set any status. Regular users forced to UNVERIFIED.
    venue_status = VenueStatus.UNVERIFIED
    if current_user.is_admin:
        if venue_data.status:
             try:
                venue_status = VenueStatus(venue_data.status)
             except ValueError:
                venue_status = VenueStatus.UNVERIFIED
    
    # Deduplication for UNVERIFIED creations (Silent Create from Google Maps)
    # If the user selects a Google Place that already exists in our DB, return the existing venue.
    if venue_status == VenueStatus.UNVERIFIED:
        # Step 1: Check match by google_place_id
        if venue_data.google_place_id:
            existing_by_id = session.exec(
                select(Venue).where(Venue.google_place_id == venue_data.google_place_id)
            ).first()
            if existing_by_id:
                return build_venue_response(existing_by_id, session)

        # Step 2: Fuzzy Match (Name + Postcode/Address)
        query = select(Venue).where(Venue.name == venue_data.name)
        if venue_data.postcode:
             query = query.where(Venue.postcode == venue_data.postcode)
        else:
             query = query.where(Venue.address == venue_data.address)
        
        existing_venue = session.exec(query).first()
        
        # Step 3: If Fuzzy match found, UPDATE venue with google_place_id and return
        if existing_venue:
            if venue_data.google_place_id and not existing_venue.google_place_id:
                existing_venue.google_place_id = venue_data.google_place_id
                session.add(existing_venue)
                session.commit()
                session.refresh(existing_venue)
            return build_venue_response(existing_venue, session)
    
    # Create venue with ALL fields from schema
    new_venue = Venue(
        name=venue_data.name,
        address=venue_data.address,
        status=venue_status,
        latitude=venue_data.latitude,
        longitude=venue_data.longitude,
        geohash=geohash,
        category_id=venue_data.category_id,
        description=venue_data.description,
        website=venue_data.website,
        phone=venue_data.phone,
        image_url=venue_data.image_url,
        formatted_address=venue_data.formatted_address,
        postcode=venue_data.postcode,
        address_full=venue_data.address_full,
        google_place_id=venue_data.google_place_id, # Added field
        # Amenities
        is_dog_friendly=venue_data.is_dog_friendly,
        has_wheelchair_access=venue_data.has_wheelchair_access,
        has_parking=venue_data.has_parking,
        serves_food=venue_data.serves_food,
        amenities_notes=venue_data.amenities_notes,
        # Social Media
        social_facebook=venue_data.social_facebook,
        social_instagram=venue_data.social_instagram,
        social_x=venue_data.social_x,
        social_linkedin=venue_data.social_linkedin,
        social_tiktok=venue_data.social_tiktok,
        website_url=venue_data.website_url,
        # Ownership
        owner_id=current_user.id
    )

    session.add(new_venue)
    session.commit()
    session.refresh(new_venue)

    return build_venue_response(new_venue, session)


@router.get("/{venue_id}", response_model=VenueResponse)
def get_venue(
    venue_id: str,
    session: Session = Depends(get_session)
):
    """
    Get a specific venue by ID.

    Returns venue details with upcoming events count.
    """
    venue = session.get(Venue, normalize_uuid(venue_id))
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found"
        )

    return build_venue_response(venue, session)


@router.get("/{venue_id}/stats", response_model=VenueStatsResponse)
def get_venue_stats(
    venue_id: str,
    session: Session = Depends(get_session)
):
    """
    Get statistics for a specific venue.

    Returns total events, upcoming events, and last event date.
    """
    venue = session.get(Venue, normalize_uuid(venue_id))
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found"
        )

    now = datetime.utcnow()

    # Total events count
    total_events = session.exec(
        select(func.count(Event.id)).where(Event.venue_id == venue.id)
    ).one()

    # Upcoming events count
    upcoming_events = session.exec(
        select(func.count(Event.id))
        .where(Event.venue_id == venue.id)
        .where(Event.date_start >= now)
    ).one()

    # Last event date (most recent event)
    last_event = session.exec(
        select(Event.date_start)
        .where(Event.venue_id == venue.id)
        .order_by(Event.date_start.desc())
        .limit(1)
    ).first()

    return VenueStatsResponse(
        total_events=total_events,
        upcoming_events=upcoming_events,
        last_event_date=last_event
    )


@router.put("/{venue_id}", response_model=VenueResponse)
def update_venue(
    venue_id: str,
    venue_data: VenueUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Update an existing venue.

    Only the venue owner or admin can update.
    """
    venue = session.get(Venue, normalize_uuid(venue_id))
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found"
        )

    # Check permissions
    if not check_venue_permission(venue, current_user, session, min_role=VenueRole.STAFF):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this venue"
        )

    # Validate optional fields
    update_data = venue_data.dict(exclude_unset=True)

    if "website" in update_data and update_data["website"]:
        url_valid, url_error = validate_url(update_data["website"])
        if not url_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=url_error
            )

    # Validate coordinates if being updated
    if "latitude" in update_data or "longitude" in update_data:
        new_lat = update_data.get("latitude", venue.latitude)
        new_lng = update_data.get("longitude", venue.longitude)
        if not is_within_highlands(new_lat, new_lng):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Venues must be located within the Highlands & Islands region."
            )

    # Apply updates to venue
    for key, value in update_data.items():
        setattr(venue, key, value)

    # Recalculate geohash if coordinates changed
    if "latitude" in update_data or "longitude" in update_data:
        venue.geohash = calculate_geohash(venue.latitude, venue.longitude)

    session.add(venue)
    session.commit()
    session.refresh(venue)

    return build_venue_response(venue, session)


@router.delete("/{venue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_venue(
    venue_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Delete a venue.

    Only the venue owner or admin can delete.
    Note: Cannot delete venue with existing events.
    """
    venue = session.get(Venue, normalize_uuid(venue_id))
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found"
        )

    # Check permissions
    if venue.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the venue owner or admin can delete this venue"
        )

    # Check for existing events
    event_count = session.exec(
        select(func.count(Event.id)).where(Event.venue_id == venue.id)
    ).one()

    if event_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete venue with {event_count} existing events"
        )

    session.delete(venue)
    session.commit()

    return None


@router.get("/{venue_id}/events", response_model=EventListResponse)
def get_venue_events(
    venue_id: str,
    status_filter: Optional[str] = Query(None, alias="status", regex="^(upcoming|past|all)$"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=500),
    session: Session = Depends(get_session)
):
    """
    Get events for a specific venue.

    Status filter:
    - upcoming: Events starting in the future
    - past: Events that have ended
    - all: All events (default)
    """
    from app.api.events import build_event_response

    venue = session.get(Venue, normalize_uuid(venue_id))
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found"
        )

    query = select(Event).where(Event.venue_id == venue.id)
    now = datetime.utcnow()

    if status_filter == "upcoming":
        query = query.where(Event.date_start >= now)
        query = query.order_by(Event.date_start.asc())
    elif status_filter == "past":
        query = query.where(Event.date_end < now)
        query = query.order_by(Event.date_start.desc())
    else:
        query = query.order_by(Event.date_start.desc())

    # Count total
    total = session.exec(
        select(func.count()).select_from(query.subquery())
    ).one()

    # Apply pagination
    query = query.offset(skip).limit(limit)
    events = session.exec(query).all()

    event_responses = [build_event_response(e, session) for e in events]

    return EventListResponse(
        events=event_responses,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("/{venue_id}/claim", response_model=VenueClaimResponse)
def claim_venue(
    venue_id: str,
    claim: VenueClaimCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Submit a claim for venue ownership.
    """
    venue = session.get(Venue, normalize_uuid(venue_id))
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")
    
    # Check if already owned by a non-admin
    if venue.owner_id:
        owner = session.get(User, venue.owner_id)
        # If owner exists and is NOT an admin, block the claim
        # We allow claiming if the owner is an admin (system-owned)
        if owner and not owner.is_admin:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Venue is already owned")
        
    # Check for existing pending claim
    existing_claim = session.exec(
        select(VenueClaim)
        .where(VenueClaim.venue_id == venue.id)
        .where(VenueClaim.user_id == current_user.id)
        .where(VenueClaim.status == "pending")
    ).first()
    
    if existing_claim:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already have a pending claim for this venue")
        
    new_claim = VenueClaim(
        venue_id=venue.id,
        user_id=current_user.id,
        reason=claim.reason,
        status="pending"
    )
    session.add(new_claim)
    session.commit()
    session.refresh(new_claim)
    
    # Notify admins
    from app.services.notifications import notification_service
    # Get admins (reuse logic or simple query)
    admin_users = session.exec(select(User).where(User.is_admin == True)).all()
    admin_emails = [u.email for u in admin_users if u.email]
    if admin_emails:
        notification_service.notify_admin_new_claim(
            admin_emails, 
            "venue", 
            venue.name, 
            current_user.email
        )

    return new_claim


@router.get("/claims/my", response_model=list[VenueClaimResponse])
def get_my_claims(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get current user's venue claims with venue data.
    """
    claims = session.exec(
        select(VenueClaim)
        .options(selectinload(VenueClaim.venue))
        .where(VenueClaim.user_id == current_user.id)
        .order_by(VenueClaim.created_at.desc())
    ).all()
    
    return claims


# ============================================================
# VENUE INVITE ACCEPTANCE (PUBLIC)
# ============================================================

@router.post("/accept-invite/{token}")
def accept_venue_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Accept a venue ownership invitation using the token.
    Instantly transfers ownership to the authenticated user.
    """
    invite = session.exec(
        select(VenueInvite).where(VenueInvite.token == token)
    ).first()
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite token")
    
    if invite.claimed:
        raise HTTPException(status_code=400, detail="This invite has already been claimed")
    
    if invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This invite has expired")
    
    # Get the venue
    venue = session.get(Venue, invite.venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    
    # Transfer ownership regardless of current owner
    # Valid invite implies authorization to transfer
    previous_owner_id = venue.owner_id
    venue.owner_id = current_user.id
    session.add(venue)

    # Optional: If previous owner was not admin, maybe remove them or add as staff? 
    # For now, simplistic "Golden Key" handover.
    
    # Mark invite as claimed
    invite.claimed = True
    invite.claimed_by_user_id = current_user.id
    invite.claimed_at = datetime.utcnow()
    session.add(invite)
    
    session.commit()
    
    return {
        "success": True,
        "message": f"You are now the owner of {venue.name}",
        "venue_id": venue.id,
        "venue_name": venue.name
    }

# ============================================================
# VENUE STAFF MANAGEMENT
# ============================================================

@router.get("/{venue_id}/staff", response_model=list[VenueStaffResponse])
def list_venue_staff(
    venue_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """List staff for a venue. Only owner or admin."""
    venue = session.get(Venue, normalize_uuid(venue_id))
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    if venue.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    staff = session.exec(select(VenueStaff).where(VenueStaff.venue_id == venue.id)).all()
    
    # Populate user details
    responses = []
    for s in staff:
        user = session.get(User, s.user_id)
        responses.append(VenueStaffResponse(
            id=s.id,
            venue_id=s.venue_id,
            user_id=s.user_id,
            role=s.role,
            created_at=s.created_at,
            user_email=user.email if user else None,
            user_username=user.username if user else None
        ))
    return responses


@router.post("/{venue_id}/staff", response_model=VenueStaffResponse)
def add_venue_staff(
    venue_id: str,
    staff_data: VenueStaffCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Add staff to a venue. Only owner or admin."""
    venue = session.get(Venue, normalize_uuid(venue_id))
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    if venue.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find user by email
    user = session.exec(select(User).where(User.email == staff_data.user_email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already staff
    existing = session.exec(
        select(VenueStaff).where(VenueStaff.venue_id == venue.id, VenueStaff.user_id == user.id)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already staff at this venue")
    
    new_staff = VenueStaff(
        venue_id=venue.id,
        user_id=user.id,
        role=staff_data.role
    )
    session.add(new_staff)
    session.commit()
    session.refresh(new_staff)
    
    return VenueStaffResponse(
        id=new_staff.id,
        venue_id=new_staff.venue_id,
        user_id=new_staff.user_id,
        role=new_staff.role,
        created_at=new_staff.created_at,
        user_email=user.email,
        user_username=user.username
    )


@router.delete("/{venue_id}/staff/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_venue_staff(
    venue_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Remove staff from a venue. Only owner or admin."""
    venue = session.get(Venue, normalize_uuid(venue_id))
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    if venue.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    staff = session.exec(
        select(VenueStaff).where(VenueStaff.venue_id == venue.id, VenueStaff.user_id == normalize_uuid(user_id))
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    session.delete(staff)
    session.commit()
    return None
