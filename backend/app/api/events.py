"""
Events API routes.
Handles event CRUD operations, filtering, and search.
"""
from datetime import datetime
from typing import Optional, List
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Request
from sqlmodel import Session, select, func
from app.core.limiter import limiter
from sqlalchemy import case

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.utils import normalize_uuid
from app.models.user import User
from app.models.event import Event
from app.models.venue import Venue
from app.models.venue_category import VenueCategory
from app.models.category import Category
from app.models.tag import Tag, EventTag, normalize_tag_name
from app.models.event_participating_venue import EventParticipatingVenue
from app.models.featured_booking import FeaturedBooking, SlotType, BookingStatus
from app.models.showtime import EventShowtime
from app.schemas.event import (
    EventCreate,
    EventUpdate,
    EventResponse,
    EventListResponse,
    EventResponse,
    EventListResponse,
    EventFilter,
    OrganizerProfileResponse
)
from app.schemas.category import CategoryResponse
from app.schemas.tag import TagResponse
from app.schemas.venue import VenueResponse
from app.schemas.tag import TagResponse
from app.schemas.tag import TagResponse
from app.services.geolocation import calculate_geohash, haversine_distance, get_bounding_box
from app.utils.price_age_parser import parse_price_input, parse_age_input
from app.services.notifications import notification_service
from app.services.resend_email import resend_email_service
from app.services.recurrence import generate_recurring_instances
from app.services.moderation import check_content_with_reason
from app.utils.pii import mask_email
import logging

logger = logging.getLogger(__name__)
from app.models.organizer import Organizer
from app.models.group_member import GroupMember, GroupRole
from app.models.event_claim import EventClaim
from app.schemas.event_claim import EventClaimCreate, EventClaimResponse
from app.core.query_utils import deduplicate_recurring_events

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



    # Get category
    category_response = None
    if event.category_rel:
        category_response = CategoryResponse.model_validate(event.category_rel)

    # Get tags
    tag_responses = [TagResponse.model_validate(t) for t in event.tags] if event.tags else []
    
    # Get participating venues
    participating_venue_responses = []
    if event.participating_venues:
        participating_venue_responses = [
            VenueResponse.model_validate(v) for v in event.participating_venues
        ]

    response = EventResponse.model_validate(event)
    
    # Override coordinates in response if we used fallback
    if event.latitude is None and venue_lat is not None:
        response.latitude = venue_lat
    if event.longitude is None and venue_lon is not None:
        response.longitude = venue_lon
        
    response.venue_name = venue_name
    response.distance_km = distance_km

    response.category = category_response
    response.participating_venues = participating_venue_responses
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
        response.organizer_profile = OrganizerProfileResponse.model_validate(event.organizer_profile)

    return response


@router.get("", response_model=EventListResponse)
@limiter.limit("100/minute")
def list_events(
    request: Request,
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
    latitude: Optional[float] = Query(None, description="User latitude for proximity search"),
    longitude: Optional[float] = Query(None, description="User longitude for proximity search"),
    radius_miles: Optional[float] = Query(None, alias="radius", description="Search radius in miles (default 20 if lat/lng provided)"),
    featured_only: bool = False,
    organizer_id: Optional[str] = Query(None, description="Filter by organizer ID"),
    organizer_profile_id: Optional[str] = Query(None, description="Filter by organizer profile (group) ID"),
    venue_id: Optional[str] = Query(None, description="Filter by venue ID"),
    include_past: bool = Query(False, description="Include past events"),
    include_past: bool = Query(False, description="Include past events"),
    time_range: Optional[str] = Query(None, description="'upcoming', 'past', or 'all'"),
    sort_by: str = Query("date", description="Sort by 'date' (default) or 'created'"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=1000),
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
    if category:
         print(f"[EVENTS_DEBUG] Filtering by category slug: {category}")

    # Handle time_range shortcuts
    # Default behavior (if no date args provided) is 'upcoming' unless specified otherwise
    if time_range == "past":
        include_past = True
        # We want events that have ENDED before now
        # Logic applied later: Event.date_end < now
        # Clear default date_from if it was set
        date_from = None
    elif time_range == "upcoming":
        # Explicit upcoming
        if date_from is None:
            date_from = datetime.utcnow()
    elif time_range == "all":
        include_past = True
        # No date restrictions by default
    
    # Legacy default: If date_from is None and not include_past, default to upcoming
    elif date_from is None and not include_past:
        date_from = datetime.utcnow()
        print(f"[EVENTS_DEBUG] No start date provided. Defaulting to Today: {date_from}")

    query = select(Event)

    # Status filter:
    # - For public listing: only show published events
    # - For organizer's own events: show published AND pending (so they can see their pending events)
    if organizer_id:
        # Organizer can see their own pending, published, rejected, and draft events
        query = query.where(Event.status.in_(["published", "pending", "rejected", "draft"]))
    else:
        # Public listing - only published
        query = query.where(Event.status == "published")

    # Track joins to avoid duplicates
    venue_joined = False
    
    # Join with active FeaturedBooking for pinned sorting
    # This allows us to prioritize events with active global_pinned or category_pinned bookings
    from datetime import date as date_today
    today = date_today.today()
    query = query.outerjoin(
        FeaturedBooking,
        (FeaturedBooking.event_id == Event.id) &
        (FeaturedBooking.status == BookingStatus.ACTIVE) &
        (FeaturedBooking.start_date <= today) &
        (FeaturedBooking.end_date >= today)
    )

    # Filter by category slug (resolves to ID first) - case-insensitive
    # Supports comma-separated list of slugs (e.g. "music,food")
    if category:
        category_list = [c.strip().lower() for c in category.split(",")]
        
        # Find all matching categories
        cats = session.exec(
            select(Category).where(
                (Category.slug.in_(category_list)) | 
                (func.lower(Category.name).in_(category_list))
            )
        ).all()
        
        if cats:
            cat_ids = [c.id for c in cats]
            query = query.where(Event.category_id.in_(cat_ids))
        else:
            # No matching categories found
            return EventListResponse(events=[], total=0, skip=skip, limit=limit)

    # Filter by single category ID (only if category slug not provided)
    if category_id and not category:
        query = query.where(Event.category_id == normalize_uuid(category_id))

    # Filter by multiple categories
    if category_ids and not category and not category_id:
        cat_id_list = [normalize_uuid(cid.strip()) for cid in category_ids.split(",")]
    # Filter by venue ID (Host OR Participating)
    if venue_id:
        v_id = normalize_uuid(venue_id)
        query = query.outerjoin(EventParticipatingVenue, Event.id == EventParticipatingVenue.event_id)
        query = query.where(
            (Event.venue_id == v_id) | 
            (EventParticipatingVenue.venue_id == v_id)
        )

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

    # Search query (title, description, venue name, venue address, venue postcode, tags) - OMNIBAR
    if q:
        search_term = f"%{q}%"
        # Generate slugified version for tag matching (e.g., "Live Music" -> "live-music")
        search_slug = normalize_tag_name(q)
        
        # Join with Venue if not already joined
        if not venue_joined:
            query = query.outerjoin(Venue, Event.venue_id == Venue.id)
            venue_joined = True
        
        # Join with EventTag and Tag for tag search
        query = query.outerjoin(EventTag, Event.id == EventTag.event_id)
        query = query.outerjoin(Tag, EventTag.tag_id == Tag.id)
        
        # Join with Category for category name search
        query = query.outerjoin(Category, Event.category_id == Category.id)
        
        query = query.where(
            (Event.title.ilike(search_term)) | 
            (Event.description.ilike(search_term)) |
            (Event.location_name.ilike(search_term)) |  # Custom location name
            (Event.address_full.ilike(search_term)) |  # Custom location address
            (Event.postcode.ilike(search_term)) |      # Custom location postcode
            (Venue.name.ilike(search_term)) |
            (Venue.address.ilike(search_term)) |
            (Venue.formatted_address.ilike(search_term)) |
            (Venue.postcode.ilike(search_term)) |
            (Tag.name == search_slug) |  # Exact match on slugified tag
            (Tag.name.ilike(f"%{search_slug}%")) |  # Partial match on tag
            (Category.name.ilike(search_term)) |  # Match category name
            (Category.slug.ilike(search_term))  # Match category slug
        )

    # Location Search (venue name, address, postcode, event location fields)
    # Only apply text-based location search if GPS coordinates are NOT provided
    if location and (latitude is None or longitude is None):
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

    # Filter by date range using OVERLAP logic for multi-day events
    # An event overlaps with range [date_from, date_to] if:
    #   event.date_start <= date_to AND event.date_end >= date_from
    if date_from or date_to:
        # Join with EventShowtime to catch multi-day events with performances on those dates
        query = query.outerjoin(EventShowtime, Event.id == EventShowtime.event_id)
        
        # Build overlap conditions for the main event dates
        overlap_conditions = []
        
        if date_from and date_to:
            # Full overlap check: event spans across or falls within the date range
            # Event overlaps if: date_start <= date_to AND date_end >= date_from
            overlap_conditions.append(
                (Event.date_start <= date_to) & (Event.date_end >= date_from)
            )
            # Also include if any showtime falls within range
            overlap_conditions.append(
                (EventShowtime.start_time >= date_from) & (EventShowtime.start_time <= date_to)
            )
        elif date_from:
            # Only date_from provided: show events that haven't ended yet as of date_from
            # event.date_end >= date_from (event is still ongoing or starts after)
            overlap_conditions.append(Event.date_end >= date_from)
            overlap_conditions.append(EventShowtime.start_time >= date_from)
        elif date_to:
            # Only date_to provided: show events that have started by date_to
            # event.date_start <= date_to
            overlap_conditions.append(Event.date_start <= date_to)
            overlap_conditions.append(EventShowtime.start_time <= date_to)
        
        # Apply overlap conditions with OR (match if any condition is true)
        from sqlalchemy import or_
        query = query.where(or_(*overlap_conditions))
        
        # Deduplicate events that matched multiple showtimes
        # Use GROUP BY instead of distinct() to allow ordering by aggregated joined columns in Postgres
        # Deduplicate events that matched multiple showtimes
        # Use GROUP BY instead of distinct() to allow ordering by aggregated joined columns in Postgres
        query = query.group_by(Event.id)
    
    # Handle explicit Time Range filters
    if time_range == "past":
        # Events that have already ended
        query = query.where(Event.date_end < datetime.utcnow())
        # Sort past events by date_start DESC (newest past event first)
        query = query.order_by(Event.date_start.desc())
    elif not include_past:
        # By default, exclude past events (using date_end to not cut off ongoing events)
        query = query.where(Event.date_end >= datetime.utcnow())

    # Filter by price range
    if price_min is not None:
        query = query.where(Event.price >= price_min)
    if price_max is not None:
        query = query.where(Event.price <= price_max)

    # Filter by featured status
    if featured_only:
        query = query.where(Event.featured == True)
        query = query.where((Event.featured_until == None) | (Event.featured_until > datetime.utcnow()))

    # Default radius to 20 miles when lat/lng provided but no radius specified
    if latitude is not None and longitude is not None and radius_miles is None:
        radius_miles = 20.0

    # Convert miles to km for internal calculations (1 mile = 1.60934 km)
    radius_km = radius_miles * 1.60934 if radius_miles is not None else None

    # Filter by geographic proximity
    if latitude is not None and longitude is not None and radius_km is not None:
        print(f"[NEAR_ME_DEBUG] START: User location: lat={latitude}, lng={longitude}, radius={radius_miles} miles ({radius_km:.2f} km)")
        min_lat, max_lat, min_lon, max_lon = get_bounding_box(latitude, longitude, radius_km)
        print(f"[NEAR_ME_DEBUG] Bounding box: lat=[{min_lat:.4f}, {max_lat:.4f}], lon=[{min_lon:.4f}, {max_lon:.4f}]")
        
        # Join with Venue if not already joined (needed for venue-based coords)
        if not venue_joined:
            print("[NEAR_ME_DEBUG] Joining Venue table...")
            query = query.outerjoin(Venue, Event.venue_id == Venue.id)
            venue_joined = True
        
        # Filter: Event in bbox OR Venue in bbox
        # This handles cases where Event coords are NULL, or invalid (e.g. 0.0), 
        # allowing the Venue's location to be used as a fallback.
        # Filter: Event in bbox OR Venue in bbox
        # This handles cases where Event coords are NULL, or invalid (e.g. 0.0), 
        # allowing the Venue's location to be used as a fallback.
        # We cast to Float to ensure type compatibility (e.g. if stored as Decimal/String)
        from sqlalchemy import cast, Float
        query = query.where(
            (
                (cast(Event.latitude, Float).between(min_lat, max_lat)) &
                (cast(Event.longitude, Float).between(min_lon, max_lon))
            ) | (
                (cast(Venue.latitude, Float).between(min_lat, max_lat)) &
                (cast(Venue.longitude, Float).between(min_lon, max_lon))
            )
        )
        
        # DEBUG: Print the generated SQL query
        try:
            compiled_query = query.compile(compile_kwargs={"literal_binds": True})
            print(f"[NEAR_ME_DEBUG] SQL Query: {compiled_query}")
        except Exception as e:
            print(f"[NEAR_ME_DEBUG] Could not compile query: {e}")

    # Filter by organizer
    if organizer_id:
        query = query.where(Event.organizer_id == normalize_uuid(organizer_id))


    # Filter by organizer profile (group)
    if organizer_profile_id:
        query = query.where(Event.organizer_profile_id == normalize_uuid(organizer_profile_id))

    # Determine if we are performing a radius search (Near Me)
    is_radius_search = latitude is not None and longitude is not None and radius_km is not None
    
    # Check if date filter is active
    has_date_filter = date_from is not None or date_to is not None

    events = []
    total = 0

    if has_date_filter:
        # Scenario B: User is filtering by date - show all matching instances
        # No deduplication, so they can find specific recurring event instances
        print(f"[EVENTS_DEBUG] Date filter active (date_from={date_from}, date_to={date_to}) - skipping deduplication")

        from sqlalchemy import func as sa_func

        # Sort Order
        pinned_priority = sa_func.min(case(
            (FeaturedBooking.slot_type == SlotType.GLOBAL_PINNED, 1),
            (FeaturedBooking.slot_type == SlotType.CATEGORY_PINNED, 2),
            (FeaturedBooking.slot_type == SlotType.HERO_HOME, 3),
            else_=4
        ))
        query = query.order_by(pinned_priority.asc(), Event.featured.desc(), Event.date_start.asc())
        
        # Override sort if created_at requested
        if sort_by == "created":
             query = query.order_by(pinned_priority.asc(), Event.featured.desc(), Event.created_at.desc())
        else:
             query = query.order_by(pinned_priority.asc(), Event.featured.desc(), Event.date_start.asc())
        
        # Only apply DB pagination if NOT doing a radius search
        if not is_radius_search:
            # Get total count via query if pagination is handled by DB
            from sqlalchemy import func as sa_func
            count_query = select(sa_func.count()).select_from(query.subquery())
            total = session.exec(count_query).one() or 0
            
            if skip:
                query = query.offset(skip)
            if limit:
                query = query.limit(limit)

        events = list(session.exec(query).all())
        
    else:
        # Scenario A: No date filter - deduplicate recurring events
        # If Radius Search: Fetch ALL candidates (limit=None) to filter by distance in memory
        # Else: Use standard DB pagination
        events, total = deduplicate_recurring_events(
            session=session,
            base_query=query,
            limit=None if is_radius_search else limit,
            offset=0 if is_radius_search else skip,
            order_by_featured=True,
            sort_field=sort_by
        )

    print(f"[NEAR_ME_DEBUG] Events found after DB query: {len(events)} (Total from DB/Dedup: {total})")

    # Apply true Haversine distance filtering (bounding box is square, this refines to circle)
    # Also sort by distance when radius filtering is active
    if is_radius_search:
        events_with_distance = []
        for event in events:
            # Get effective coordinates (event coords or fallback to venue coords)
            event_lat = event.latitude
            event_lon = event.longitude
            
            # Treat 0.0 as invalid/missing coordinates
            has_event_coords = (
                event_lat is not None and event_lon is not None and 
                (abs(event_lat) > 0.0001 or abs(event_lon) > 0.0001)
            )
            
            # print(f"[NEAR_ME_DEBUG] Event '{event.title}' (ID: {event.id}) - Has Event Coords: {has_event_coords}")

            if not has_event_coords:
                if event.venue_id:
                    venue = session.get(Venue, event.venue_id)
                    if venue:
                        event_lat = venue.latitude
                        event_lon = venue.longitude
                else:
                    # Logic to fetch from attached venue if not joined? 
                    # Usually already handled or venue_id is None
                    pass

            # Calculate true distance and filter
            if event_lat is not None and event_lon is not None:
                dist_km = haversine_distance(latitude, longitude, event_lat, event_lon)
                # dist_miles = dist_km / 1.60934  
                if dist_km <= radius_km:
                    events_with_distance.append((event, dist_km))
        
        # Sort by distance (nearest first)
        events_with_distance.sort(key=lambda x: x[1])
        
        # Update events and total based on filtered results
        filtered_events = [e[0] for e in events_with_distance]
        total = len(filtered_events)
        
        print(f"[NEAR_ME_DEBUG] Final count after Haversine: {total}")
        
        # Apply Pagination in Memory
        events = filtered_events[skip : skip + limit]

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



@router.get("/top", response_model=EventListResponse)
def get_top_events(
    limit: int = Query(default=10, ge=1, le=50),
    session: Session = Depends(get_session)
):
    """
    Get top events ranked by popularity score with fallback to chronological order.
    
    Score = (view_count * 1) + (attending_count * 5) + (ticket_click_count * 10)
    
    Sorting:
    - Primary: popularity_score DESC (highest engagement first)
    - Secondary: date_start ASC (sooner events first, for ties/cold start)
    
    Only returns future approved events.
    """
    from app.models.analytics import AnalyticsEvent
    
    now = datetime.utcnow()
    
    # 1. Fetch upcoming approved events (limit to 50 for efficiency)
    upcoming_events = session.exec(
        select(Event)
        .where(Event.date_start > now)
        .where(Event.status == "published")
        .order_by(Event.date_start)
        .limit(50)
    ).all()
    
    if not upcoming_events:
        return EventListResponse(events=[], total=0, skip=0, limit=limit)
    
    # 2. Get all relevant analytics in one query
    analytics = session.exec(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.event_type.in_(["event_view", "save_event", "click_ticket"]))
    ).all()
    
    # 3. Build analytics counts per event (null-safe)
    event_stats = {}
    for ae in analytics:
        target_id = (ae.event_metadata or {}).get("target_id")
        if target_id:
            normalized_id = target_id.replace("-", "")
            if normalized_id not in event_stats:
                event_stats[normalized_id] = {"views": 0, "saves": 0, "clicks": 0}
            
            if ae.event_type == "event_view":
                event_stats[normalized_id]["views"] += 1
            elif ae.event_type == "save_event":
                event_stats[normalized_id]["saves"] += 1
            elif ae.event_type == "click_ticket":
                event_stats[normalized_id]["clicks"] += 1
    
    # 4. Calculate popularity score for each event (null-safe with defaults)
    events_with_scores = []
    for event in upcoming_events:
        normalized_id = str(event.id).replace("-", "")
        stats = event_stats.get(normalized_id, {})
        
        # Null-safe score calculation: coalesce to 0
        views = stats.get("views", 0) or 0
        saves = stats.get("saves", 0) or 0
        clicks = stats.get("clicks", 0) or 0
        
        # Formula: views * 1 + saves * 5 + clicks * 10
        score = (views * 1) + (saves * 5) + (clicks * 10)
        events_with_scores.append((event, score, event.date_start))
    
    # 5. Two-phase sort: Primary = score DESC, Secondary = date_start ASC
    events_with_scores.sort(key=lambda x: (-x[1], x[2]))
    top_events = [e[0] for e in events_with_scores[:limit]]
    
    # 6. Build responses
    event_responses = [build_event_response(event, session) for event in top_events]
    
    return EventListResponse(
        events=event_responses,
        total=len(event_responses),
        skip=0,
        limit=limit
    )


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event_data: EventCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    background_tasks: BackgroundTasks = None # Optional for tests
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
    else:
        # Use custom location if provided
        if event_data.latitude is not None and event_data.longitude is not None:
            latitude = event_data.latitude
            longitude = event_data.longitude
            geohash = calculate_geohash(latitude, longitude)
        
        # Validation: Must have venue_id OR location_name OR participating_venue_ids
        has_participating = event_data.participating_venue_ids and len(event_data.participating_venue_ids) > 0
        
        if not event_data.location_name and not has_participating:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either venue_id or location_name must be provided"
            )

    # Validate organizer profile (group) membership if provided
    organizer_profile_id_normalized = None
    if event_data.organizer_profile_id:
        organizer_profile_id_normalized = normalize_uuid(event_data.organizer_profile_id)
        organizer_profile = session.get(Organizer, organizer_profile_id_normalized)
        if not organizer_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organizer profile (group) not found"
            )
        
        # Verify permission using shared logic (handles God Mode)
        from app.core.permissions import require_group_role
        from app.models.group_member import GroupRole

        require_group_role(
            session, 
            organizer_profile_id_normalized, 
            current_user, 
            [GroupRole.OWNER, GroupRole.ADMIN, GroupRole.EDITOR], # Any member can create
            organizer_profile
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
        event_data.frequency = event_data.frequency.upper()
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
    
    # Parse price and age inputs
    price_display, min_price = parse_price_input(event_data.price)
    age_restriction_str, min_age = parse_age_input(event_data.age_restriction)
    
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
        price=min_price,  # Backward compatibility (numeric)
        price_display=price_display,  # User-friendly text
        min_price=min_price,  # For filtering
        image_url=event_data.image_url,
        organizer_id=normalize_uuid(current_user.id),
        # Phase 2.10 fields
        ticket_url=event_data.ticket_url,
        website_url=event_data.website_url,
        is_all_day=event_data.is_all_day if event_data.is_all_day is not None else False,
        age_restriction=age_restriction_str,  # Backward compatibility (string)
        min_age=min_age,  # Numeric for filtering
        # Phase 2.3 fields
        organizer_profile_id=organizer_profile_id_normalized,
        recurrence_rule=recurrence_rule,
        is_recurring=event_data.is_recurring if event_data.is_recurring is not None else False,
        # For recurring events, set recurrence_group_id to own ID (will be shared with children)
        recurrence_group_id=normalize_uuid(uuid4()) if (event_data.is_recurring if event_data.is_recurring is not None else False) else None,
        # Status will be set below based on trust evaluation
        status="pending",
    # Map Display Point
        map_display_lat=event_data.map_display_lat,
        map_display_lng=event_data.map_display_lng,
        map_display_label=event_data.map_display_label
    )
    
    
    # --- 1. Duplicate Detection ---
    from app.services.duplicate_detection import check_duplicate_risk
    from app.models.report import Report
    import json
    
    risk_score, meta = check_duplicate_risk(new_event, session)
    is_duplicate_risk = risk_score >= 75
    if is_duplicate_risk:
        print(f"[DUPLICATE_DETECT] High Risk ({risk_score}%) detected for '{new_event.title}'")

    # --- 2. Content Moderation (Profanity) ---
    content_to_check = f"{event_data.title or ''} {event_data.description or ''}"
    if event_data.tags:
        content_to_check += " " + " ".join(event_data.tags)
    
    moderation_result = check_content_with_reason(content_to_check)
    is_offensive = moderation_result["flagged"]
    moderation_reason = moderation_result["reason"]
    
    # --- 3. Link Warden ---
    import re
    link_pattern = re.compile(
        r'(https?://|www\.|\.com|\.co\.uk|\.org|\.net|\.io|\.info|\.biz)',
        re.IGNORECASE
    )
    content_for_link_check = f"{event_data.title or ''} {event_data.description or ''}"
    contains_link = bool(link_pattern.search(content_for_link_check))
    
    # --- 4. Auto-Approval Check ---
    is_auto_approved = (
        current_user.is_admin or
        current_user.is_trusted_organizer or
        current_user.trust_level >= 5
    )

    # --- Status Decision Tree ---
    if is_offensive:
        new_event.status = "pending" # Keep as pending for admin to review/reject? Or rejected?
        # Original code said "pending" with reason.
        new_event.moderation_reason = moderation_reason
        logger.info(f"[PROFANITY_FILTER] Event '{new_event.title}' flagged: {moderation_reason}")
        
    elif is_duplicate_risk:
        new_event.status = "pending_moderation"
        new_event.moderation_reason = "Potential Duplicate"
        
        # Create Moderation Report
        report = Report(
            target_type="event",
            target_id=new_event.id,
            reason="Potential Duplicate",
            details=json.dumps(meta),
            status="pending",
            reporter_id="system" 
        )
        session.add(report)
        logger.info(f"[DUPLICATE_DETECT] Event '{new_event.title}' flagged as duplicate.")

    elif contains_link and not current_user.is_admin and not current_user.is_trusted_organizer:
        new_event.status = "pending"
        new_event.moderation_reason = "Contains External Link"
        logger.info(f"[LINK_WARDEN] Event '{new_event.title}' pending (link detected)")
        
    elif is_auto_approved:
        new_event.status = "published"
        logger.info(f"[AUTO_APPROVE] Event '{new_event.title}' auto-approved.")
        
    else:
        new_event.status = "pending"
        logger.info(f"[MODERATION] Event '{new_event.title}' pending (standard review).")
    session.add(new_event)
    session.flush()  # Get the event ID

    # Handle tags
    if event_data.tags:
        tags = get_or_create_tags(session, event_data.tags)
        for tag in tags:
            event_tag = EventTag(event_id=new_event.id, tag_id=tag.id)
            session.add(event_tag)
            tag.usage_count += 1
            
    # Handle participating venues
    if event_data.participating_venue_ids:
        for p_venue_id in event_data.participating_venue_ids:
            # Verify venue exists
            p_venue_exists = session.get(Venue, normalize_uuid(p_venue_id))
            if p_venue_exists:
                p_venue_link = EventParticipatingVenue(
                    event_id=new_event.id, 
                    venue_id=normalize_uuid(p_venue_id)
                )
                session.add(p_venue_link)

    # ---------------------------------------------------------
    # Task 3: Multi-Venue Map Display Logic (Centroid Fallback)
    # ---------------------------------------------------------
    # If no custom map point is set, calculating centroid of all participating venues
    if new_event.map_display_lat is None or new_event.map_display_lng is None:
        if event_data.participating_venue_ids:
            # We have IDs, fetch the venues to get coords
            # Optimization: We can fetch them in one batch query instead of loop above, 
            # but usually this list is small (<20).
            # We can re-fetch or use session cache.
            # Let's query venues by ID list
            p_venue_uuids = [normalize_uuid(vid) for vid in event_data.participating_venue_ids]
            p_venues = session.exec(select(Venue).where(Venue.id.in_(p_venue_uuids))).all()
            
            valid_venues = [v for v in p_venues if v.latitude is not None and v.longitude is not None]
            count = len(valid_venues)
            
            if count > 0:
                total_lat = sum(v.latitude for v in valid_venues)
                total_lng = sum(v.longitude for v in valid_venues)
                
                new_event.map_display_lat = total_lat / count
                new_event.map_display_lng = total_lng / count
                # Default label if missing
                if not new_event.map_display_label:
                    new_event.map_display_label = "Event Location (Center)"
                
                logger.info(f"[CREATE_EVENT] Calculated Centroid for Multi-Venue Event {new_event.id}: {new_event.map_display_lat}, {new_event.map_display_lng}")

    # Handle showtimes
    if event_data.showtimes:
        for showtime_data in event_data.showtimes:
            showtime = EventShowtime(
                event_id=new_event.id,
                start_time=showtime_data.start_time,
                end_time=showtime_data.end_time,
                ticket_url=showtime_data.ticket_url,
                notes=showtime_data.notes
            )
            session.add(showtime)

    session.commit()
    session.refresh(new_event)

    # Generate recurring event instances based on weekdays selection
    if new_event.is_recurring:
        # Use centralized recurrence service
        # Fallback to defaults if weekdays not provided (service handles it)
        from app.services.recurrence import generate_recurring_instances
        
        generate_recurring_instances(
            session=session,
            parent_event=new_event,
            weekdays=event_data.weekdays,
            recurrence_end_date=event_data.recurrence_end_date
        )
    elif new_event.is_recurring and new_event.recurrence_rule:
        # Fallback to old RRULE-based generation if weekdays not provided
        try:
            generate_recurring_instances(session, new_event, window_days=90)
        except Exception as e:
            print(f"Error generating instances for {new_event.id}: {e}")

    # Send appropriate notifications based on approval status
    if current_user.email:
        try:
            if is_auto_approved:
                # Send auto-approval email via Resend
                resend_email_service.send_event_approved(
                    to_email=current_user.email,
                    event_title=new_event.title,
                    event_id=str(new_event.id),
                    display_name=current_user.display_name,
                    is_auto_approved=True
                )
                logger.info(f"Auto-approval email sent to {mask_email(current_user.email)} for event {new_event.id}")
                # No admin notification needed for auto-approved events (notification_service)
                # But send EMAIL alert as requested
                from app.services.email_service import send_new_event_notification
                # Resolve venue name
                v_name = new_event.location_name
                if not v_name and new_event.venue_id:
                     v = session.get(Venue, new_event.venue_id)
                     if v: v_name = v.name
                
                background_tasks.add_task(
                    send_new_event_notification,
                    new_event.title,
                    str(new_event.id),
                    v_name,
                    new_event.status
                )
            else:
                # Notify user their event is under review (fallback to notification_service)
                notification_service.notify_event_submission(current_user.email, new_event.title)

                # Notify admins about new pending event
                admin_users = session.exec(select(User).where(User.is_admin == True)).all()
                admin_emails = [u.email for u in admin_users if u.email]
                if admin_emails:
                    notification_service.notify_admin_new_pending_event(
                        admin_emails,
                        new_event.title,
                        new_event.title,
                        current_user.email
                    )
                
                # Send EMAIL alert to ADMIN_EMAIL (New Event Posted)
                from app.services.email_service import send_new_event_notification
                v_name = new_event.location_name
                if not v_name and new_event.venue_id:
                     v = session.get(Venue, new_event.venue_id)
                     if v: v_name = v.name

                background_tasks.add_task(
                    send_new_event_notification,
                    new_event.title,
                    str(new_event.id),
                    v_name,
                    new_event.status
                )
        except Exception as e:
            # Log error but don't fail the request - event creation succeeded
            logger.error(f"Failed to send notification email for event {new_event.id}: {e}")

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
    session: Session = Depends(get_session),
    background_tasks: BackgroundTasks = None
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

    # Capture original status for moderation check
    original_status = event.status

    # Check permissions - normalize both IDs for comparison
    user_id_str = str(current_user.id).replace('-', '')
    organizer_id_str = str(event.organizer_id).replace('-', '') if event.organizer_id else ''
    
    # Check if user is the venue owner (cascade permission)
    is_venue_owner = False
    if event.venue_id:
        venue = session.get(Venue, event.venue_id)
        if venue and venue.owner_id:
            venue_owner_id_str = str(venue.owner_id).replace('-', '')
            is_venue_owner = venue_owner_id_str == user_id_str
    
    if organizer_id_str != user_id_str and not is_venue_owner and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this event"
        )

    # Update fields (exclude tags, participating_venue_ids, showtimes, and explicit dates for special handling)
    update_data = event_data.model_dump(exclude_unset=True, exclude={"tags", "participating_venue_ids", "showtimes", "date_start", "date_end", "is_recurring"})

    # DEBUG: Log what we received
    logger.info(f"[UPDATE_EVENT] Event ID: {event_id}")
    logger.info(f"[UPDATE_EVENT] Received update_data keys: {list(update_data.keys())}")

    # 1. Priority Update: Always update dates if provided
    if event_data.date_start is not None:
        logger.info(f"[UPDATE_EVENT] explicit date_start: {event_data.date_start}")
        event.date_start = event_data.date_start
    
    if event_data.date_end is not None:
        logger.info(f"[UPDATE_EVENT] explicit date_end: {event_data.date_end}")
        event.date_end = event_data.date_end

    # 2. Handle Recurring Status Logic
    # Check if recurrence details changed
    recurrence_changed = False
    new_frequency = update_data.get("frequency")
    new_weekdays = update_data.get("weekdays")
    new_recurrence_end = update_data.get("recurrence_end_date")
    
    if event_data.is_recurring is not None:
        if event.is_recurring != event_data.is_recurring:
            event.is_recurring = event_data.is_recurring
            recurrence_changed = True
            
        if event_data.is_recurring is False:
            # Explicitly turning OFF recurrence -> Clear showtimes and future instances
            logger.info(f"[UPDATE_EVENT] Turning OFF recurrence for {event_id}. Clearing showtimes.")
            existing_showtimes = session.exec(
                select(EventShowtime).where(EventShowtime.event_id == event.id)
            ).all()
            for st in existing_showtimes:
                session.delete(st)
            # Also clear RRULE if present
            event.recurrence_rule = None
            
            # CRITICAL: Delete future instances
            now = datetime.utcnow()
            future_children = session.exec(
                select(Event).where(
                    Event.parent_event_id == event.id,
                    Event.date_start > now
                )
            ).all()
            for child in future_children:
                session.delete(child)

    # Detect changes in schedule keys if recurrence is ON
    if event.is_recurring and (new_frequency or new_weekdays or new_recurrence_end):
        recurrence_changed = True
        
    # Logic for Regenerating Recursion (The "Clean Slate" Strategy)
    if recurrence_changed and event.is_recurring:
        # 1. Update RRULE string on parent (if frequency provided)
        # Note: We rely on generating new instances, but we should also update the RRULE for record
        # Ideally we reconstruct it.
        if new_frequency:
             new_frequency = new_frequency.upper()
             base_rule = ""
             if new_frequency == "WEEKLY": base_rule = "FREQ=WEEKLY"
             elif new_frequency == "BIWEEKLY": base_rule = "FREQ=WEEKLY;INTERVAL=2"
             elif new_frequency == "MONTHLY": base_rule = "FREQ=MONTHLY"
             
             if base_rule:
                 if new_recurrence_end:
                     until_str = new_recurrence_end.strftime("%Y%m%dT%H%M%SZ")
                     base_rule += f";UNTIL={until_str}"
                 elif event_data.recurrence_end_date: # fallback if in root
                      until_str = event_data.recurrence_end_date.strftime("%Y%m%dT%H%M%SZ")
                      base_rule += f";UNTIL={until_str}"
                 event.recurrence_rule = base_rule

        # 2. Delete ALL future instances
        now = datetime.utcnow()
        future_children = session.exec(
            select(Event).where(
                Event.parent_event_id == event.id,
                Event.date_start > now
            )
        ).all()
        for child in future_children:
            session.delete(child)
        session.flush() # Commit deletes before regenerating
        
        # 3. Regenerate
        from app.services.recurrence import generate_recurring_instances
        generate_recurring_instances(
            session=session,
            parent_event=event,
            weekdays=new_weekdays or [], # If None, might need to fetch from existing? 
            # Note: If updating, user usually sends the full week list. 
            # If they don't send weekdays, we might assume NO weekdays selected? 
            # Safest is to treat it as "Use what's provided".
            recurrence_end_date=new_recurrence_end or event_data.recurrence_end_date
        )

    # Validate category if being updated
    if "category_id" in update_data:
        category = session.get(Category, normalize_uuid(update_data["category_id"]))
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found"
            )
        update_data["category_id"] = normalize_uuid(update_data["category_id"])

    # Parse price if being updated
    if "price" in update_data:
        price_display, min_price = parse_price_input(update_data["price"])
        update_data["price"] = min_price  # Keep legacy field as float
        update_data["price_display"] = price_display
        update_data["min_price"] = min_price
    
    # Parse age_restriction if being updated
    if "age_restriction" in update_data:
        age_restriction_str, min_age = parse_age_input(update_data["age_restriction"])
        update_data["age_restriction"] = age_restriction_str  # Keep legacy field
        update_data["min_age"] = min_age

    # Update Showtimes if provided (Only if is_recurring is not False, or if user explicitly provides them)
    # Note: If is_recurring was set to False above, we cleared showtimes. 
    # If showtimes are provided in the same payload, we assume they want to add them (and maybe is_recurring should be true?)
    # But usually frontend sends is_recurring=False and showtimes=[]/None.
    if event_data.showtimes is not None:
        # Clear existing showtimes (redundant if we did it above, but safe)
        stmt = select(EventShowtime).where(EventShowtime.event_id == event.id)
        existing_showtimes = session.exec(stmt).all()
        for st in existing_showtimes:
            session.delete(st)
        
        # Add new showtimes
        for st_data in event_data.showtimes:
            new_showtime = EventShowtime(
                event_id=event.id,
                start_time=st_data.start_time,
                end_time=st_data.end_time,
                ticket_url=st_data.ticket_url,
                notes=st_data.notes
            )
            session.add(new_showtime)

    # Exclude transient fields and explicitly handled relationships from generic update
    excluded_fields = {"frequency", "weekdays", "recurrence_end_date", "showtimes"}
    for field, value in update_data.items():
        if field in excluded_fields:
            continue
            
        if field in ("venue_id", "organizer_profile_id") and value is not None:
            value = normalize_uuid(value)
        setattr(event, field, value)

    # Update geohash based on location source
    if "venue_id" in update_data and update_data["venue_id"]:
        # Venue selected - use venue coordinates
        venue = session.get(Venue, normalize_uuid(update_data["venue_id"]))
        if venue:
            event.latitude = venue.latitude
            event.longitude = venue.longitude
            event.geohash = calculate_geohash(venue.latitude, venue.longitude)
    elif "venue_id" in update_data and update_data["venue_id"] is None:
        # Venue removed - check if manual lat/lng provided
        if "latitude" in update_data and "longitude" in update_data:
            # Manual location provided - keep the coords and recalculate geohash
            if event.latitude and event.longitude:
                event.geohash = calculate_geohash(event.latitude, event.longitude)
            else:
                event.geohash = None
        else:
            # No manual location - clear coordinates
            event.latitude = None
            event.longitude = None
            event.geohash = None

    # Handle participating venues update
    if event_data.participating_venue_ids is not None:
        # Clear existing participating venues
        session.exec(
            select(EventParticipatingVenue).where(EventParticipatingVenue.event_id == event.id)
        )
        existing_links = session.exec(
            select(EventParticipatingVenue).where(EventParticipatingVenue.event_id == event.id)
        ).all()
        for link in existing_links:
            session.delete(link)
        
        # Add new participating venues
        for venue_id in event_data.participating_venue_ids:
            venue = session.get(Venue, normalize_uuid(str(venue_id)))
            if venue:
                link = EventParticipatingVenue(event_id=event.id, venue_id=venue.id)
                session.add(link)

    # ---------------------------------------------------------
    # Task 3: Multi-Venue Map Display Logic (Centroid Fallback)
    # ---------------------------------------------------------
    # If no custom map point is set, calculating centroid of all participating venues
    if event.map_display_lat is None or event.map_display_lng is None:
        # Fetch fresh list of participating venues
        p_venues_stmt = select(Venue).join(EventParticipatingVenue).where(EventParticipatingVenue.event_id == event.id)
        participating_venues = session.exec(p_venues_stmt).all()
        
        if participating_venues:
            # Calculate Centroid
            valid_venues = [v for v in participating_venues if v.latitude is not None and v.longitude is not None]
            count = len(valid_venues)
            
            if count > 0:
                total_lat = sum(v.latitude for v in valid_venues)
                total_lng = sum(v.longitude for v in valid_venues)
                
                event.map_display_lat = total_lat / count
                event.map_display_lng = total_lng / count
                # Default label if missing
                if not event.map_display_label:
                    event.map_display_label = "Event Location (Center)"
                
                logger.info(f"[UPDATE_EVENT] Calculated Centroid for Multi-Venue Event {event.id}: {event.map_display_lat}, {event.map_display_lng}")

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

    # Moderation Logic: 
    # 1. If published event is edited by non-trusted user, revert to pending
    # 2. If rejected event is edited, reset to pending for re-review
    if (original_status == "published" and not (current_user.is_admin or current_user.is_trusted_organizer)) or (original_status == "rejected"):
        event.status = "pending"
        event.moderation_reason = "Edited after rejection/publication"
        logger.info(f"[MODERATION] Event '{event.title}' reset to pending update by user {current_user.id}")
        
        # Trigger Admin Alert (Moderation Required)
        from app.services.email_service import send_moderation_required_notification
        if background_tasks:
            background_tasks.add_task(
                send_moderation_required_notification,
                event.title,
                str(event.id)
            )

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

    # Check permissions - normalize IDs for comparison
    user_id_str = str(current_user.id).replace('-', '')
    organizer_id_str = str(event.organizer_id).replace('-', '') if event.organizer_id else ''
    
    # Check if user is the venue owner (cascade permission)
    is_venue_owner = False
    if event.venue_id:
        venue = session.get(Venue, event.venue_id)
        if venue and venue.owner_id:
            venue_owner_id_str = str(venue.owner_id).replace('-', '')
            is_venue_owner = venue_owner_id_str == user_id_str
    
    if organizer_id_str != user_id_str and not is_venue_owner and not current_user.is_admin:
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
            # Cleanup dependencies for child
            child_featured = session.exec(select(FeaturedBooking).where(FeaturedBooking.event_id == child.id)).all()
            for fb in child_featured:
                session.delete(fb)
            
            child_venues = session.exec(select(EventParticipatingVenue).where(EventParticipatingVenue.event_id == child.id)).all()
            for pv in child_venues:
                session.delete(pv)

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

    # Cleanup dependencies for main event
    featured_bookings = session.exec(select(FeaturedBooking).where(FeaturedBooking.event_id == event.id)).all()
    for fb in featured_bookings:
        session.delete(fb)

    participating_venues = session.exec(select(EventParticipatingVenue).where(EventParticipatingVenue.event_id == event.id)).all()
    for pv in participating_venues:
        session.delete(pv)

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


# ============================================================
# EVENT CLAIMING
# ============================================================

@router.post("/{event_id}/claim", response_model=EventClaimResponse)
def claim_event(
    event_id: str,
    claim: EventClaimCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Submit a claim for event ownership/management.
    Useful for venue owners or original organizers who want to manage an event.
    """
    event = session.get(Event, normalize_uuid(event_id))
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    
    # Check if user already owns the event
    user_id_str = str(current_user.id).replace('-', '')
    organizer_id_str = str(event.organizer_id).replace('-', '') if event.organizer_id else ''
    if organizer_id_str == user_id_str:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already own this event")
    
    # Check for existing pending claim
    existing_claim = session.exec(
        select(EventClaim)
        .where(EventClaim.event_id == event.id)
        .where(EventClaim.user_id == current_user.id)
        .where(EventClaim.status == "pending")
    ).first()
    
    if existing_claim:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already have a pending claim for this event")
    
    new_claim = EventClaim(
        event_id=event.id,
        user_id=current_user.id,
        reason=claim.reason,
        status="pending"
    )
    session.add(new_claim)
    session.commit()
    session.refresh(new_claim)

    # Notify admins
    from app.services.notifications import notification_service
    # Get admins
    admin_users = session.exec(select(User).where(User.is_admin == True)).all()
    admin_emails = [u.email for u in admin_users if u.email]
    if admin_emails:
        notification_service.notify_admin_new_claim(
            admin_emails, 
            "event", 
            event.title, 
            current_user.email
        )
    
    return EventClaimResponse(
        id=new_claim.id,
        event_id=new_claim.event_id,
        user_id=new_claim.user_id,
        status=new_claim.status,
        reason=new_claim.reason,
        created_at=new_claim.created_at,
        updated_at=new_claim.updated_at,
        event_title=event.title,
        user_email=current_user.email
    )


@router.get("/claims/my", response_model=list[EventClaimResponse])
def get_my_event_claims(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get current user's event claims."""
    claims = session.exec(
        select(EventClaim)
        .where(EventClaim.user_id == current_user.id)
        .order_by(EventClaim.created_at.desc())
    ).all()
    
    results = []
    for c in claims:
        event = session.get(Event, c.event_id)
        results.append(EventClaimResponse(
            id=c.id,
            event_id=c.event_id,
            user_id=c.user_id,
            status=c.status,
            reason=c.reason,
            created_at=c.created_at,
            updated_at=c.updated_at,
            event_title=event.title if event else "Deleted Event",
            user_email=current_user.email
        ))
    
    return results
