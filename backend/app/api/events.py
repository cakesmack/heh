"""
Events API routes.
Handles event CRUD operations, filtering, and search.
"""
from datetime import datetime
from typing import Optional, List
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.utils import normalize_uuid
from app.models.user import User
from app.models.event import Event
from app.models.venue import Venue
from app.models.category import Category
from app.models.tag import Tag, EventTag, normalize_tag_name
from app.schemas.event import (
    EventCreate,
    EventUpdate,
    EventResponse,
    EventListResponse
)
from app.schemas.category import CategoryResponse
from app.schemas.tag import TagResponse
from app.schemas.tag import TagResponse
from app.schemas.tag import TagResponse
from app.services.geolocation import calculate_geohash, haversine_distance, get_bounding_box
from app.services.notifications import notification_service
from app.services.recurrence import generate_recurring_instances
from app.models.organizer import Organizer

router = APIRouter(tags=["Events"])


def get_or_create_tags(session: Session, tag_names: List[str]) -> List[Tag]:
    """Get existing tags or create new ones. Returns list of Tag objects."""
    tags = []
    for name in tag_names[:5]:  # Max 5 tags
        normalized = normalize_tag_name(name)
        if not normalized:
            continue

        tag = session.exec(select(Tag).where(Tag.name == normalized)).first()
        if not tag:
            tag = Tag(id=normalize_uuid(uuid4()), name=normalized)
            session.add(tag)
            session.flush()  # Ensure tag is persisted before use
        tags.append(tag)

    return tags


def build_event_response(event: Event, session: Session, user_lat: float = None, user_lon: float = None) -> EventResponse:
    """Build EventResponse with computed fields."""
    # Get venue details and fallback coordinates
    venue_name = None
    venue_lat = None
    venue_lon = None
    
    if event.venue_id:
        venue = session.get(Venue, event.venue_id)
        if venue:
            venue_name = venue.name
            venue_lat = venue.latitude
            venue_lon = venue.longitude
    elif event.location_name:
        venue_name = event.location_name

    # Determine final coordinates (Event overrides Venue)
    final_lat = event.latitude if event.latitude is not None else venue_lat
    final_lon = event.longitude if event.longitude is not None else venue_lon

    # Calculate distance if coordinates provided and user location known
    distance_km = None
    if user_lat is not None and user_lon is not None and final_lat is not None and final_lon is not None:
        distance_km = haversine_distance(user_lat, user_lon, final_lat, final_lon)

    # Count check-ins
    checkin_count = len(event.check_ins) if event.check_ins else 0

    # Get category
    category_response = None
    if event.category_rel:
        category_response = CategoryResponse.model_validate(event.category_rel)

    # Get tags
    tag_responses = [TagResponse.model_validate(t) for t in event.tags] if event.tags else []

    response = EventResponse.model_validate(event)
    
    # Override coordinates in response if we used fallback
    if event.latitude is None and venue_lat is not None:
        response.latitude = venue_lat
    if event.longitude is None and venue_lon is not None:
        response.longitude = venue_lon
        
    response.venue_name = venue_name
    response.distance_km = distance_km
    response.checkin_count = checkin_count
    response.category = category_response
    # Fetch analytics counts
    from app.models.analytics import AnalyticsEvent
    
    # Normalize ID for comparison with metadata
    normalized_id = str(event.id).replace("-", "")
    
    # This is slightly expensive per-event, but necessary for the dashboard.
    # In a larger app, we would use a join or an aggregated stats table.
    analytics = session.exec(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.event_type.in_(["event_view", "save_event", "click_ticket"]))
    ).all()
    
    view_count = 0
    save_count = 0
    ticket_click_count = 0
    
    for ae in analytics:
        target_id = ae.event_metadata.get("target_id") if ae.event_metadata else None
        if target_id and target_id.replace("-", "") == normalized_id:
            if ae.event_type == "event_view":
                view_count += 1
            elif ae.event_type == "save_event":
                save_count += 1
            elif ae.event_type == "click_ticket":
                ticket_click_count += 1

    response.view_count = view_count
    response.save_count = save_count
    response.ticket_click_count = ticket_click_count
    
    # Populate organizer details for admin/dashboard
    if event.organizer:
        response.organizer_email = event.organizer.email
    if event.organizer_profile:
        response.organizer_profile_name = event.organizer_profile.name

    return response


@router.get("", response_model=EventListResponse)
def list_events(
    category_id: Optional[str] = None,
    category: Optional[str] = Query(None, description="Category slug for filtering"),
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs"),
    tag_names: Optional[str] = Query(None, description="Comma-separated tag names"),
    tag: Optional[str] = Query(None, description="Single tag slug/name for filtering"),
    q: Optional[str] = Query(None, description="Search query for title/description"),
    location: Optional[str] = Query(None, description="Search query for location (name, address, postcode)"),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    age_restriction: Optional[str] = Query(None, description="Filter by age restriction"),
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: Optional[float] = None,
    featured_only: bool = False,
    organizer_id: Optional[str] = Query(None, description="Filter by organizer ID"),
    organizer_profile_id: Optional[str] = Query(None, description="Filter by organizer profile (group) ID"),
    venue_id: Optional[str] = Query(None, description="Filter by venue ID"),
    include_past: bool = Query(False, description="Include past events"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=1000),
    session: Session = Depends(get_session)
):
    """
    List events with optional filtering.

    Filter options:
    - category: Filter by category slug (e.g., 'music', 'food-drink')
    - category_id: Filter by category ID
    - tag: Filter by single tag name
    - tag_names: Filter by comma-separated tag names
    - q: Search in title and description
    - location: Search in venue name, address, postcode, and event location fields
    - age_restriction: Filter by age restriction
    """
    query = select(Event)

    # Only show published/approved events in public listing
    query = query.where(Event.status == "published")

    # Track joins to avoid duplicates
    venue_joined = False

    # Filter by category slug (resolve to ID first)
    if category:
        cat = session.exec(
            select(Category).where(
                (Category.slug == category) | (Category.id == normalize_uuid(category))
            )
        ).first()
        if cat:
            query = query.where(Event.category_id == cat.id)
        else:
            # No matching category, return empty
            return EventListResponse(events=[], total=0, skip=skip, limit=limit)

    # Filter by single category ID (only if category slug not provided)
    if category_id and not category:
        query = query.where(Event.category_id == normalize_uuid(category_id))

    # Filter by multiple categories
    if category_ids and not category and not category_id:
        cat_id_list = [normalize_uuid(cid.strip()) for cid in category_ids.split(",")]
        query = query.where(Event.category_id.in_(cat_id_list))

    # Filter by venue ID
    if venue_id:
        query = query.where(Event.venue_id == normalize_uuid(venue_id))

    # Filter by single tag
    if tag and not tag_names:
        normalized_tag = normalize_tag_name(tag)
        query = query.join(EventTag, Event.id == EventTag.event_id).join(
            Tag, EventTag.tag_id == Tag.id
        ).where(Tag.name == normalized_tag)

    # Filter by multiple tags
    if tag_names:
        tag_list = [normalize_tag_name(t.strip()) for t in tag_names.split(",")]
        # Join with EventTag and Tag to filter
        query = query.join(EventTag, Event.id == EventTag.event_id).join(
            Tag, EventTag.tag_id == Tag.id
        ).where(Tag.name.in_(tag_list))

    # Search query (title, description)
    if q:
        search_term = f"%{q}%"
        query = query.where(
            (Event.title.ilike(search_term)) | 
            (Event.description.ilike(search_term))
        )

    # Location Search (venue name, address, postcode, event location fields)
    if location:
        loc_term = f"%{location}%"
        if not venue_joined:
            query = query.outerjoin(Venue, Event.venue_id == Venue.id)
            venue_joined = True
            
        query = query.where(
            (Venue.name.ilike(loc_term)) |
            (Venue.address.ilike(loc_term)) |
            (Venue.postcode.ilike(loc_term)) |
            (Venue.formatted_address.ilike(loc_term)) |
            (Event.location_name.ilike(loc_term)) |
            (Event.postcode.ilike(loc_term)) |
            (Event.address_full.ilike(loc_term))
        )

    # Filter by age restriction
    if age_restriction:
        query = query.where(Event.age_restriction == age_restriction)

    # Filter by date range
    if date_from:
        query = query.where(Event.date_start >= date_from)
    elif not include_past:
        # By default, exclude past events (using date_end to not cut off ongoing events)
        query = query.where(Event.date_end >= datetime.utcnow())
    if date_to:
        query = query.where(Event.date_end <= date_to)

    # Filter by price range
    if price_min is not None:
        query = query.where(Event.price >= price_min)
    if price_max is not None:
        query = query.where(Event.price <= price_max)

    # Filter by featured status
    if featured_only:
        query = query.where(Event.featured == True)
        query = query.where((Event.featured_until == None) | (Event.featured_until > datetime.utcnow()))

    # Filter by geographic proximity
    if latitude is not None and longitude is not None and radius_km is not None:
        min_lat, max_lat, min_lon, max_lon = get_bounding_box(latitude, longitude, radius_km)
        query = query.where(
            Event.latitude.between(min_lat, max_lat),
            Event.longitude.between(min_lon, max_lon)
        )

    # Filter by organizer
    if organizer_id:
        query = query.where(Event.organizer_id == normalize_uuid(organizer_id))

    # Filter by organizer profile (group)
    if organizer_profile_id:
        query = query.where(Event.organizer_profile_id == normalize_uuid(organizer_profile_id))

    # Order by: featured first, then by date
    query = query.order_by(Event.featured.desc(), Event.date_start)

    # Deduplication Logic
    # We want to show only the next upcoming instance for each recurring series.
    group_key = func.coalesce(Event.parent_event_id, Event.id)
    
    # Check dialect to determine strategy
    # SQLite allows GROUP BY with non-aggregated columns (picking arbitrary row), Postgres does not.
    # Postgres supports DISTINCT ON, which is perfect for this.
    is_postgres = session.bind.dialect.name == "postgresql"
    
    if is_postgres:
        # Postgres: Use DISTINCT ON
        # We must order by the distinct key first
        query = query.distinct(group_key).order_by(group_key, Event.date_start)
        
        # Count total (groups)
        count_query = select(func.count()).select_from(query.subquery())
        total = session.exec(count_query).one()
        
        # Wrap in subquery to apply final sort (Featured DESC, Date ASC) and pagination
        sub = query.subquery()
        outer_query = select(Event).from_statement(
            select(sub).order_by(sub.c.featured.desc(), sub.c.date_start).offset(skip).limit(limit)
        )
        events = session.exec(outer_query).all()
        
    else:
        # SQLite: Use GROUP BY (legacy behavior)
        query = query.group_by(group_key)
        
        # Count total (groups)
        count_query = select(func.count()).select_from(query.subquery())
        total = session.exec(count_query).one()
        
        # Order by featured, then date
        query = query.order_by(Event.featured.desc(), func.min(Event.date_start))
        
        # Pagination
        query = query.offset(skip).limit(limit)
        events = session.exec(query).all()

    # Build responses
    event_responses = [
        build_event_response(event, session, latitude, longitude)
        for event in events
    ]

    return EventListResponse(
        events=event_responses,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event_data: EventCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Create a new event.
    """
    # Validate venue or location
    venue_id_normalized = None
    latitude = None
    longitude = None
    geohash = None

    if event_data.venue_id:
        venue_id_normalized = normalize_uuid(event_data.venue_id)
        venue = session.get(Venue, venue_id_normalized)
        if not venue:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Venue not found"
            )
        # Use venue coordinates
        latitude = venue.latitude
        longitude = venue.longitude
        geohash = calculate_geohash(latitude, longitude)
    elif not event_data.location_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either venue_id or location_name must be provided"
        )

    # Validate category
    category_id_normalized = None
    if event_data.category_id:
        category_id_normalized = normalize_uuid(event_data.category_id)
        category = session.get(Category, category_id_normalized)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found"
            )

    # Handle Recurrence Rule Translation
    recurrence_rule = event_data.recurrence_rule
    if event_data.is_recurring and event_data.frequency:
        freq_map = {
            "WEEKLY": "FREQ=WEEKLY",
            "BIWEEKLY": "FREQ=WEEKLY;INTERVAL=2",
            "MONTHLY": "FREQ=MONTHLY"
        }
        base_rule = freq_map.get(event_data.frequency)
        if base_rule:
            recurrence_rule = base_rule
            if event_data.recurrence_end_date:
                # Format: YYYYMMDDTHHMMSSZ
                until_str = event_data.recurrence_end_date.strftime("%Y%m%dT%H%M%SZ")
                recurrence_rule += f";UNTIL={until_str}"
    
    # Create event
    new_event = Event(
        id=normalize_uuid(uuid4()),
        title=event_data.title,
        description=event_data.description or "",
        date_start=event_data.date_start,
        date_end=event_data.date_end,
        venue_id=venue_id_normalized,
        location_name=event_data.location_name,
        latitude=latitude,
        longitude=longitude,
        geohash=geohash,
        category_id=category_id_normalized,
        price=event_data.price,
        image_url=event_data.image_url,
        organizer_id=normalize_uuid(current_user.id),
        # Phase 2.10 fields
        ticket_url=event_data.ticket_url,
        age_restriction=event_data.age_restriction,
        # Phase 2.3 fields
        organizer_profile_id=normalize_uuid(event_data.organizer_profile_id) if event_data.organizer_profile_id else None,
        recurrence_rule=recurrence_rule,
        is_recurring=event_data.is_recurring if event_data.is_recurring is not None else False,
        status="published" if current_user.is_admin or current_user.trust_level >= 3 else "pending"
    )

    session.add(new_event)
    session.flush()  # Get the event ID

    # Handle tags
    if event_data.tags:
        tags = get_or_create_tags(session, event_data.tags)
        for tag in tags:
            event_tag = EventTag(event_id=new_event.id, tag_id=tag.id)
            session.add(event_tag)
            tag.usage_count += 1

    session.commit()
    session.refresh(new_event)

    # Generate initial instances if recurring
    if new_event.is_recurring and new_event.recurrence_rule:
        try:
            generate_recurring_instances(session, new_event, window_days=90)
        except Exception as e:
            print(f"Error generating instances for {new_event.id}: {e}")
            # Don't fail the request, just log it. 
            # The cron job can pick it up later or user can retry.

    # Send Notification
    if current_user.email:
        notification_service.notify_event_submission(current_user.email, new_event.title)

    return build_event_response(new_event, session)


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: str,
    session: Session = Depends(get_session)
):
    """
    Get a specific event by ID.
    """
    event = session.get(Event, normalize_uuid(event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    return build_event_response(event, session)


@router.post("/{event_id}/recurring", response_model=List[EventResponse])
def generate_recurring_events(
    event_id: str,
    window_days: int = Query(default=90, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Generate recurring instances for a parent event.
    """
    event = session.get(Event, normalize_uuid(event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
        
    # Check permissions
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to manage this event"
        )
        
    if not event.is_recurring or not event.recurrence_rule:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event is not recurring"
        )
        
    new_instances = generate_recurring_instances(session, event, window_days)
    
    return [
        build_event_response(instance, session)
        for instance in new_instances
    ]


@router.post("/{event_id}/stop-recurrence", status_code=status.HTTP_200_OK)
def stop_recurrence(
    event_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Stop a recurring event series.
    - Updates parent to stop recurring.
    - Deletes all FUTURE instances.
    - Preserves PAST instances.
    """
    event = session.get(Event, normalize_uuid(event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # Resolve to parent if this is a child instance
    parent_event = event
    if event.parent_event_id:
        parent_event = session.get(Event, event.parent_event_id)
        if not parent_event:
            # Fallback if parent missing (orphan), just treat this as the one to stop
            parent_event = event

    # Check permissions on the parent
    if parent_event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to manage this event series"
        )

    # 1. Update Parent
    parent_event.is_recurring = False
    parent_event.recurrence_rule = None
    session.add(parent_event)

    # 2. Delete Future Children
    now = datetime.utcnow()
    future_children = session.exec(
        select(Event).where(
            Event.parent_event_id == parent_event.id,
            Event.date_start > now
        )
    ).all()

    count = len(future_children)
    for child in future_children:
        session.delete(child)

    session.commit()
    
    return {"message": f"Recurrence stopped. {count} future instances deleted."}


@router.put("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: str,
    event_data: EventUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Update an existing event.
    """
    event = session.get(Event, normalize_uuid(event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # Check permissions - normalize both IDs for comparison
    user_id_str = str(current_user.id).replace('-', '')
    organizer_id_str = str(event.organizer_id).replace('-', '') if event.organizer_id else ''
    if organizer_id_str != user_id_str and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this event"
        )

    # Update fields
    update_data = event_data.model_dump(exclude_unset=True, exclude={"tags"})

    # Validate category if being updated
    if "category_id" in update_data:
        category = session.get(Category, normalize_uuid(update_data["category_id"]))
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found"
            )
        update_data["category_id"] = normalize_uuid(update_data["category_id"])

    for field, value in update_data.items():
        if field in ("venue_id", "organizer_profile_id") and value is not None:
            value = normalize_uuid(value)
        setattr(event, field, value)

    # Update geohash if venue changed
    if "venue_id" in update_data and update_data["venue_id"]:
        venue = session.get(Venue, event.venue_id)
        if venue:
            event.latitude = venue.latitude
            event.longitude = venue.longitude
            event.geohash = calculate_geohash(venue.latitude, venue.longitude)
    elif "venue_id" in update_data and update_data["venue_id"] is None:
        # Venue removed, clear coordinates unless we implement manual location geocoding later
        event.latitude = None
        event.longitude = None
        event.geohash = None

    # Handle tags update
    if event_data.tags is not None:
        # Remove old tags and decrement counts
        old_event_tags = session.exec(
            select(EventTag).where(EventTag.event_id == event.id)
        ).all()
        for et in old_event_tags:
            old_tag = session.get(Tag, et.tag_id)
            if old_tag and old_tag.usage_count > 0:
                old_tag.usage_count -= 1
            session.delete(et)

        # Add new tags
        if event_data.tags:
            new_tags = get_or_create_tags(session, event_data.tags)
            for tag in new_tags:
                event_tag = EventTag(event_id=event.id, tag_id=tag.id)
                session.add(event_tag)
                tag.usage_count += 1

    event.updated_at = datetime.utcnow()

    session.add(event)
    session.commit()
    session.refresh(event)

    return build_event_response(event, session)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    delete_children: bool = Query(default=True, description="Delete all child instances if this is a recurring parent event"),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Delete an event.
    If this is a recurring parent event and delete_children=True, 
    all child instances will also be deleted.
    """
    event = session.get(Event, normalize_uuid(event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # Check permissions
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this event"
        )

    children_deleted = 0
    
    # If this is a recurring parent event, delete all child instances first
    if event.is_recurring and delete_children:
        children = session.exec(
            select(Event).where(Event.parent_event_id == event.id)
        ).all()
        children_deleted = len(children)
        for child in children:
            # Decrement tag usage counts for child
            child_event_tags = session.exec(
                select(EventTag).where(EventTag.event_id == child.id)
            ).all()
            for et in child_event_tags:
                tag = session.get(Tag, et.tag_id)
                if tag and tag.usage_count > 0:
                    tag.usage_count -= 1
                session.delete(et)
            session.delete(child)

    # Decrement tag usage counts for main event
    event_tags = session.exec(
        select(EventTag).where(EventTag.event_id == event.id)
    ).all()
    for et in event_tags:
        tag = session.get(Tag, et.tag_id)
        if tag and tag.usage_count > 0:
            tag.usage_count -= 1
        session.delete(et)

    session.delete(event)
    session.commit()

    return None
