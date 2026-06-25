import logging
from datetime import datetime

logger = logging.getLogger(__name__)
from typing import Optional, List
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Request
from sqlmodel import Session, select, func, col, update, delete
from sqlalchemy import or_, and_
from app.core.limiter import limiter
from sqlalchemy import case

from app.core.database import get_session, engine
from app.core.security import get_current_user, get_current_user_optional
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
from app.models.bookmark import Bookmark
from app.models.event_attendee import EventAttendee
from app.schemas.event import (
    EventCreate,
    EventUpdate,
    EventResponse,
    EventListResponse,
    EventResponse,
    EventListResponse,
    EventListResponse,
    EventFilter,
    OrganizerProfileResponse,
    MapEventResponse
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
from app.services.cloudflare_service import get_cloudflare_url, is_cloudflare_configured
import re

# NC500 Geographic Data for Automated Tagging
NC500_WAYPOINTS = [
    (57.4778, -4.2247, "Inverness"),
    (57.5954, -4.4284, "Dingwall"),
    (57.8812, -4.0298, "Dornoch"),
    (58.1189, -3.6521, "Helmsdale"),
    (58.4419, -3.0945, "Wick"),
    (58.6373, -3.0686, "John o' Groats"),
    (58.5936, -3.5221, "Thurso"),
    (58.4819, -4.4170, "Tongue"),
    (58.5705, -4.7431, "Durness"),
    (58.1465, -5.2443, "Lochinver"),
    (57.8956, -5.1609, "Ullapool"),
    (57.7279, -5.6904, "Gairloch"),
    (57.4322, -5.8147, "Applecross"),
    (57.5593, -5.7588, "Torridon"),
    (57.5185, -4.4611, "Muir of Ord"),
    (57.3000, -4.4500, "Beauly"),
    (57.8105, -3.9871, "Golspie"), # Approx
    (58.0125, -3.8544, "Brora"), # Approx
]

NC500_TOWNS = [
    "inverness", "dingwall", "dornoch", "wick", "thurso", "durness", 
    "ullapool", "gairloch", "applecross", "lochinver", "helmsdale", 
    "john o' groats", "john o groats", "tongue", "scourie", 
    "kinlochbervie", "poolewe", "shieldaig", "torridon", "contin", "garve",
    "muir of ord", "strathpeffer", "golspie", "brora", "lybster", "dunbeath",
    "castletown", "halkirk", "bettyhill", "kylesku", "drumbeg", "achiltibuie", 
    "laide", "aultbea", "kinlochewe", "strathcarron", "lochcarron", "stromeferry", 
    "plockton", "kyle of lochalsh", "beauly"
]

def apply_geographic_tagging(session: Session, event: Event):
    """
    Automatically applies 'nc500' tag based on location name or coordinates.
    Uses radial coordinate checks (15-mile radius) and fuzzy town matching.
    """
    is_nc500 = False
    
    # 1. Fuzzy Location Name Match (case-insensitive substring)
    if event.location_name:
        loc_lower = event.location_name.lower()
        if any(town in loc_lower for town in NC500_TOWNS):
            is_nc500 = True
            
    # 2. Radial Coordinate Check (if not already matched)
    if not is_nc500 and event.latitude is not None and event.longitude is not None:
        # Check against core waypoints
        for waypoint_lat, waypoint_lon, name in NC500_WAYPOINTS:
            # 10km radius (approx 6.2 miles) to prevent jumps over water (e.g. to Skye)
            distance = haversine_distance(event.latitude, event.longitude, waypoint_lat, waypoint_lon)
            if distance <= 10.0: 
                is_nc500 = True
                logger.info(f"[NC500_AUTO] Coordinate match: '{event.title}' is within 10km of {name}")
                break
                
    if is_nc500:
        # Apply 'nc500' tag
        tags = get_or_create_tags(session, ["nc500"])
        if tags:
            tag = tags[0]
            # Check if association already exists
            existing = session.exec(
                select(EventTag).where(
                    EventTag.event_id == event.id,
                    EventTag.tag_id == tag.id
                )
            ).first()
            
            is_deleted = existing in session.deleted if existing else False
            
            # Check in-memory pending additions in the session
            pending = any(
                isinstance(obj, EventTag) and obj.event_id == event.id and obj.tag_id == tag.id
                for obj in session.new
            )
            
            if (not existing or is_deleted) and not pending:
                event_tag = EventTag(event_id=event.id, tag_id=tag.id)
                session.add(event_tag)
                tag.usage_count += 1
                logger.info(f"[NC500_AUTO] Automatically tagged event '{event.title}' ({event.id}) with 'nc500'")

def get_thumbnail_url(image_url: str) -> Optional[str]:
    """
    Generate a compressed thumbnail URL based on the provider.
    """
    if not image_url:
        return None
    
    # 1. Cloudflare Image ID (exactly 36-char UUID or similar)
    if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', image_url, re.IGNORECASE):
        if is_cloudflare_configured():
            return get_cloudflare_url(image_url, "thumbnail")
        return image_url # Fallback if IDs used but env missing
        
    # 2. Cloudinary URL
    if "res.cloudinary.com" in image_url:
        if "/upload/" in image_url and "/upload/f_auto" not in image_url:
            # Inject auto format, high compression, and specific width
            return image_url.replace("/upload/", "/upload/f_auto,q_auto,c_limit,w_600/")
        return image_url

    # 3. Local/Relative paths
    if image_url.startswith("/"):
        return image_url

    # 4. Fallback for external URLs or already processed URLs
    return image_url


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


def build_event_response(
    event: Event, 
    session: Session, 
    user_lat: float = None, 
    user_lon: float = None,
    current_user: Optional[User] = None
) -> EventResponse:
    """Build EventResponse with computed fields."""
    start_date = event.date_start
    end_date = event.date_end
    is_upcoming = False

    # Resolve Next Occurrence for Display
    if event.is_recurring and event.parent_event_id is None and event.recurrence_group_id:
        from datetime import timezone
        # Query all active/published instances of the recurrence group sorted by start date
        query = select(Event.date_start, Event.date_end).where(
            Event.recurrence_group_id == event.recurrence_group_id,
            Event.status == "published"
        ).order_by(Event.date_start.asc())
        
        instances = session.exec(query).all()
        if instances:
            now = datetime.utcnow()
            # Handle timezone awareness safely
            first_inst_start = instances[0][0]
            if first_inst_start.tzinfo is not None:
                now = datetime.now(timezone.utc)
                
            # 1. Look for the closest upcoming instance (start_date >= now)
            upcoming_instances = [inst for inst in instances if inst[0] >= now]
            if upcoming_instances:
                start_date, end_date = upcoming_instances[0][0], upcoming_instances[0][1]
                is_upcoming = True
            else:
                # 2. Check if there is an ongoing instance (start_date <= now <= end_date)
                ongoing_instances = [inst for inst in instances if inst[0] <= now <= inst[1]]
                if ongoing_instances:
                    start_date, end_date = ongoing_instances[0][0], ongoing_instances[0][1]
                    is_upcoming = True
                else:
                    # 3. Fallback: all instances are in the past. Use the last occurrence (most recent past date)
                    start_date, end_date = instances[-1][0], instances[-1][1]
                    is_upcoming = False
        else:
            now = datetime.utcnow()
            if start_date.tzinfo is not None:
                now = datetime.now(timezone.utc)
            is_upcoming = start_date >= now
    elif event.is_recurring:
        # For a child instance, we just compare its own date_start to determine if it is upcoming
        now = datetime.utcnow()
        if start_date.tzinfo is not None:
            from datetime import timezone
            now = datetime.now(timezone.utc)
        is_upcoming = start_date >= now

    # Get venue details and fallback coordinates
    venue_name = None
    venue_lat = None
    venue_lon = None
    venue_owner_id = None
    
    if event.venue_id:
        venue = session.get(Venue, event.venue_id)
        if venue:
            venue_name = venue.name
            venue_lat = venue.latitude
            venue_lon = venue.longitude
            venue_owner_id = venue.owner_id
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
    
    # Override start and end dates with resolved occurrence values
    response.date_start = start_date
    response.date_end = end_date
    
    # Override coordinates in response if we used fallback
    if event.latitude is None and venue_lat is not None:
        response.latitude = venue_lat
    if event.longitude is None and venue_lon is not None:
        response.longitude = venue_lon
        
    response.venue_name = venue_name
    response.venue_owner_id = venue_owner_id
    response.distance_km = distance_km

    response.category = category_response
    response.participating_venues = participating_venue_responses
    
    # Generate thumbnail URL
    if event.image_url:
        response.thumbnail_url = get_thumbnail_url(event.image_url)
    
    # Fetch analytics counts
    from app.models.analytics import AnalyticsEvent
    
    # Normalize ID for comparison with metadata
    normalized_id = str(event.id).replace("-", "")
    
    # This is slightly expensive per-event, but necessary for the dashboard.
    # In a larger app, we would use a join or an aggregated stats table.
    # PERFORMANCE HOTFIX: Commented out real-time analytics
    # The previous code was fetching the entire table for every event.
    # TODO: Replace with an optimized SQL GROUP BY query in the main list_events function.
    
    # analytics = session.exec(
    #    select(AnalyticsEvent)
    #    .where(AnalyticsEvent.event_type.in_(["event_view", "save_event", "click_ticket"]))
    # ).all()
    
    # Temporary placeholder to restore speed
    view_count = 0
    save_count = 0
    ticket_click_count = 0

    # for ae in analytics:
    #     target_id = ae.event_metadata.get("target_id") if ae.event_metadata else None
    #     if target_id and target_id.replace("-", "") == normalized_id:
    #         if ae.event_type == "event_view":
    #             view_count += 1
    #         elif ae.event_type == "save_event":
    #             save_count += 1
    #         elif ae.event_type == "click_ticket":
    #             ticket_click_count += 1

    response.view_count = event.view_count
    response.attending_count = event.attending_count
    response.save_count = event.save_count
    response.ticket_click_count = event.ticket_click_count
    response.website_click_count = event.website_click_count
    
    # Calculate Velocity Score (Trending/Popularity)
    # Algorithm: (Raw Score) / (Days Live)
    # Raw Score = (Views * 1) + (Attending * 5) + (Tickets * 10) + (Website * 5)
    raw_score = (
        event.view_count + 
        (event.attending_count * 5) + 
        (event.ticket_click_count * 10) + 
        (event.website_click_count * 5)
    )
    # Days Live = max(1, days since created_at)
    now = datetime.utcnow()
    duration = now - event.created_at
    days_live = max(1.0, duration.total_seconds() / 86400.0)
    response.popularity_score = round(raw_score / days_live, 2)
    
    # Populate organizer details for admin/dashboard
    if event.organizer:
        response.organizer_email = event.organizer.email
    if event.organizer_profile:
        response.organizer_profile_name = event.organizer_profile.name
        response.organizer_profile = OrganizerProfileResponse.model_validate(event.organizer_profile)

    # Resolve Next Occurrence for Display
    if event.is_recurring:
        response.next_occurrence = start_date
        response.is_upcoming_occurrence = is_upcoming
    else:
        response.next_occurrence = None
        response.is_upcoming_occurrence = False
    # Check Attendance & Bookmark Status (Pure ORM Match)
    if current_user:
        try:
            # Check Attendance (Strictly Normalized Match)
            attendee_record = session.exec(
                select(EventAttendee).where(
                    EventAttendee.user_id == current_user.id,
                    EventAttendee.event_id == normalize_uuid(event.id)
                )
            ).first()
            response.is_attending = attendee_record is not None

            # Clean Bookmark Check
            bookmark_record = session.exec(
                select(Bookmark).where(
                    Bookmark.user_id == current_user.id,
                    Bookmark.event_id == event.id
                )
            ).first()
            response.is_bookmarked = bookmark_record is not None
            
        except Exception as e:
            logger.error(f"ORM status check failed: {e}")
            response.is_attending = False
            response.is_bookmarked = False

    return response


@router.get("/map", response_model=List[MapEventResponse])
@limiter.limit("60/minute")
def list_events_map(
    request: Request,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    category_id: Optional[str] = None,
    latitude: Optional[float] = Query(None, description="User latitude"),
    longitude: Optional[float] = Query(None, description="User longitude"),
    radius_miles: Optional[float] = Query(None, alias="radius", description="Search radius in miles"),
    q: Optional[str] = Query(None, description="Search keyword"),
    session: Session = Depends(get_session)
):
    """
    Lean endpoint for Map View. Returns flattened list of events.
    Optimized for performance: selects only essential columns.
    """
    from sqlalchemy.orm import selectinload
    
    # 1. Base Query with minimal relationships (Join Category for color/name)
    query = select(Event).options(
        selectinload(Event.category_rel), 
        selectinload(Event.venue)
    )
    
    # 2. Status Filter
    query = query.where(Event.status == "published")
    
    # 3. Date Filter (Simplified: Overlap logic)
    if not date_from:
        date_from = datetime.utcnow()
        
    if date_to:
         # Overlap: start <= to AND end >= from
        query = query.where((Event.date_start <= date_to) & (Event.date_end >= date_from))
    else:
        # Just upcoming
        query = query.where(Event.date_end >= date_from)
        
    # 4. Category Filter
    if category_id:
        query = query.where(Event.category_id == normalize_uuid(category_id))
        
        query = query.where(
            (Event.latitude.between(min_lat, max_lat)) & 
            (Event.longitude.between(min_lon, max_lon))
        )

    # 6. Keyword Filter (Search)
    if q:
        search_term = f"%{q}%"
        # Always join Venue for keyword search if not already filtered by radius
        # (Though listinload(Event.venue) is used above, we need a join for where clause)
        query = query.outerjoin(Venue, Event.venue_id == Venue.id)
        
        # Tags joining logic (matching list_events)
        from app.models.tag import EventTag, Tag
        query = query.outerjoin(EventTag, Event.id == EventTag.event_id)
        query = query.outerjoin(Tag, EventTag.tag_id == Tag.id)

        # Build conditions
        search_conditions = [
            Event.title.ilike(search_term),
            Event.description.ilike(search_term),
            Event.location_name.ilike(search_term),
            Event.address_full.ilike(search_term),
            Venue.name.ilike(search_term),
            Venue.address.ilike(search_term),
            Tag.name.ilike(search_term)
        ]
        query = query.where(or_(*search_conditions)).distinct()

    # 7. Select Limit (Safety)
    query = query.limit(1000)

    # 8. Execute
    events = session.exec(query).all()
    
    # 8. Build lightweight responses
    responses = []
    for event in events:
        resp = MapEventResponse.model_validate(event)
        
        # Populate computed Venue Name if missing from event
        if not resp.venue_name and event.venue:
             resp.venue_name = event.venue.name

        # Populate Category (Manual mapping due to field name mismatch: category_rel -> category)
        if not resp.category and event.category_rel:
             resp.category = CategoryResponse.model_validate(event.category_rel)

        # Force populate location_name (ensure it carries over)
        if not resp.location_name and event.location_name:
             resp.location_name = event.location_name
        
        # Populate thumbnail_url
        if event.image_url:
            resp.thumbnail_url = get_thumbnail_url(event.image_url)
        
        responses.append(resp)
        
    return responses


@router.get("", response_model=EventListResponse)
@limiter.limit("100/minute")
def list_events(
    request: Request,
    category_id: Optional[str] = None,
    category: Optional[str] = Query(None, description="Category slug for filtering"),
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs"),
    tag_names: Optional[str] = Query(None, description="Comma-separated tag names"),
    tag_ids: Optional[str] = Query(None, description="Comma-separated tag IDs"),
    tag: Optional[str] = Query(None, description="Single tag slug/name for filtering"),
    q: Optional[str] = Query(None, description="Search query for title/description"),
    location: Optional[str] = Query(None, description="Search query for location (name, address, postcode)"),
    city_filter: Optional[str] = Query(None, description="Strict filter by city name (for SEO pages)"),
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
    status: Optional[str] = Query(None, description="Filter by explicit status (e.g. 'pending')"),
    is_recurring: Optional[bool] = Query(None, description="Filter by recurrence status"),
    max_duration_days: Optional[float] = Query(None, description="Maximum event duration in days"),

    time_range: Optional[str] = Query(None, description="'upcoming', 'past', or 'all'"),
    sort_by: str = Query("date", description="Sort by 'date' (default) or 'created'"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=1000),
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional) # Security Requirement
):
    """
    List events with optional filtering.
    SECURED: Filters non-published events for public users.
    """
    if category:
         print(f"[EVENTS_DEBUG] Filtering by category slug: {category}")

    # Define absolute now (for Python-side logic)
    from datetime import timezone, timedelta
    now_utc = datetime.now(timezone.utc)
    today_date = now_utc.date()

    # Handle time_range shortcuts
    if time_range == "past":
        include_past = True
        date_from = None
    elif time_range == "upcoming":
        include_past = False
        if date_from is None:
            date_from = now_utc
    elif time_range == "all":
        include_past = True
    elif time_range in ["week", "month"]:
        include_past = True  # We have explicit bounds
    elif not date_from and not date_to and time_range in ["today", "tomorrow", "weekend", "this_weekend"]:
        # Phase 3 Refactor: Elevated date parsing covers BOTH standard + SEO scenarios
        if time_range == "today":
            date_from = now_utc
            date_to = datetime(today_date.year, today_date.month, today_date.day, 23, 59, 59, tzinfo=timezone.utc)
        elif time_range == "tomorrow":
            tmrw = today_date + timedelta(days=1)
            date_from = datetime(tmrw.year, tmrw.month, tmrw.day, 0, 0, 0, tzinfo=timezone.utc)
            date_to = datetime(tmrw.year, tmrw.month, tmrw.day, 23, 59, 59, tzinfo=timezone.utc)
        elif time_range in ["weekend", "this_weekend"]:
            weekday = today_date.weekday() # Mon=0, Sun=6
            if weekday >= 4: # Fri(4), Sat(5), Sun(6)
                date_from = now_utc
                days_until_sunday = 6 - weekday
                sun = today_date + timedelta(days=days_until_sunday)
                date_to = datetime(sun.year, sun.month, sun.day, 23, 59, 59, tzinfo=timezone.utc)
            else: 
                # Mon-Thu: Next Friday
                days_until_friday = 4 - weekday
                fri = today_date + timedelta(days=days_until_friday)
                sun = fri + timedelta(days=2)
                date_from = datetime(fri.year, fri.month, fri.day, 0, 0, 0, tzinfo=timezone.utc)
                date_to = datetime(sun.year, sun.month, sun.day, 23, 59, 59, tzinfo=timezone.utc)
        include_past = True  # We have explicit bounds, don't force Upcoming 'func.now()' filter
    elif date_from is None and not include_past:
        date_from = now_utc

    # Update sort_by for past events automatically if not already specified
    if time_range == "past" and sort_by == "date":
        sort_by = "date_desc"

    query = select(Event)

    # --- STATUS FILTER (SECURITY CRITICAL) ---
    # Default: Show ONLY "published"
    # Exception 1: Admin can see everything
    # Exception 2: Organizer can see their own (pending/rejected/draft)
    
    is_admin = current_user.is_admin if current_user else False
    
    # Check if user is viewing their OWN events
    is_self_viewer = False
    if current_user and organizer_id:
        normalized_user_id = str(current_user.id).replace("-", "")
        normalized_target_id = str(organizer_id).replace("-", "")
        if normalized_user_id == normalized_target_id:
             is_self_viewer = True

    if is_admin:
        # Admin sees all - no status filter (unless manually added?) 
        # Actually usually admins want to see published by default in listing unless filtering
        # But for "Moderation Queue", they use different endpoints.
        # For general feed, maybe admin wants to see everything? 
        # Let's keep it loose for admin, or default to published?
        # User request: "If Admin: Show all statuses."
        pass 
    elif is_self_viewer:
        # Organizer sees own events in all states, including archived
        query = query.where(Event.status.in_(["published", "pending", "rejected", "draft", "pending_moderation", "archived"]))
    else:
        # Public / Guest / Other Users
        # STRICTLY PUBLISHED
        query = query.where(Event.status == "published")

    # Explicit Status Filter (requested via param)
    if status:
        query = query.where(Event.status == status)

    # Use SQL-side func.now() for more reliable filtering
    sql_now = func.now()
    # Additional Organizer Filter (if param provided)
    if organizer_id:
        query = query.where(Event.organizer_id == normalize_uuid(organizer_id))

    # If sorting by 'created' (Recently Added), filter out child recurring instances
    if sort_by == 'created':
        query = query.where(Event.parent_event_id == None)

    # ... (rest of filtering logic) ...
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
        # Try dual-resolution to translate a potential slug into a UUID
        venue_lookup = session.exec(select(Venue).where(Venue.slug == venue_id)).first()
        v_id = venue_lookup.id if venue_lookup else normalize_uuid(venue_id)
        
        query = query.outerjoin(EventParticipatingVenue, Event.id == EventParticipatingVenue.event_id)
        query = query.where(
            (Event.venue_id == v_id) | 
            (EventParticipatingVenue.venue_id == v_id)
        )

    # Tag filtering logic with join tracking
    event_tag_joined = False
    tag_joined = False

    # 1. Prioritize tag_ids (JSON-first, SEO-heavy architecture)
    if tag_ids:
        # Ensure it's a list even if a single string is passed
        actual_ids = tag_ids if isinstance(tag_ids, list) else [tag_ids]
        print(f"DATABASE_CHECK: Filtering for IDs: {actual_ids}", flush=True)
        query = query.join(Event.tags).filter(Tag.id.in_(actual_ids))
        event_tag_joined = True
        tag_joined = True
        
    # 2. Filter by multiple tags (legacy/fallback)
    elif tag_names:
        tag_list = [normalize_tag_name(t.strip()) for t in tag_names.split(",")]
        if not event_tag_joined:
            query = query.join(EventTag, Event.id == EventTag.event_id)
            event_tag_joined = True
        query = query.join(Tag, EventTag.tag_id == Tag.id)
        tag_joined = True
        query = query.where(Tag.name.in_(tag_list))
        
    # 3. Filter by single tag (legacy/fallback)
    elif tag:
        normalized_tag = normalize_tag_name(tag)
        if not event_tag_joined:
            query = query.join(EventTag, Event.id == EventTag.event_id)
            event_tag_joined = True
        if not tag_joined:
            query = query.join(Tag, EventTag.tag_id == Tag.id)
            tag_joined = True
        query = query.where(Tag.name == normalized_tag)

    # --- SCENARIO B: SEO Page (Strict City Filter) ---
    if city_filter:
        print(f"DEBUG: City Filter Active: '{city_filter}'")

        # 1. Base Query
        query = select(Event)
        
        # Apply Status Filter first
        if not is_admin:
             query = query.where(Event.status == "published")

        # Join Venue strictly for filtering
        query = query.outerjoin(Venue, Event.venue_id == Venue.id)

        # 2. STRICT Location Filter
        query = query.where(
            or_(
                col(Venue.address).ilike(f"%{city_filter}%"),
                col(Venue.formatted_address).ilike(f"%{city_filter}%"),
                col(Venue.name).ilike(f"%{city_filter}%"),
                Event.location_name.ilike(f"%{city_filter}%")
            )
        )
        
        # 3. APPLY CATEGORY FILTER (If provided)
        if category:
            category_list = [c.strip().lower() for c in category.split(",")]
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
                 return EventListResponse(events=[], total=0, skip=skip, limit=limit)
        
        # 4. APPLY DATE FILTER (Time Range / Custom Dates)
        sql_now = func.now()
        # Time Range presets (today, tomorrow, weekend) are now resolved universally at the top of the function.

        if time_range == "past":
            query = query.where(func.coalesce(Event.date_end, Event.date_start) < sql_now)
        elif time_range == "week":
            from sqlalchemy import text
            query = query.where(Event.date_start >= func.current_date())
            query = query.where(Event.date_start <= func.current_date() + text("INTERVAL '7 days'"))
        elif time_range == "month":
            from sqlalchemy import text
            query = query.where(Event.date_start >= func.current_date())
            query = query.where(Event.date_start <= func.current_date() + text("INTERVAL '30 days'"))
        elif date_from or date_to:
             # Custom Range Logic (Overlap)
            query = query.outerjoin(EventShowtime, Event.id == EventShowtime.event_id)
            overlap_conditions = []
            if date_from and date_to:
                overlap_conditions.append((Event.date_start <= date_to) & (func.coalesce(Event.date_end, Event.date_start) >= date_from))
            elif date_from:
                overlap_conditions.append(func.coalesce(Event.date_end, Event.date_start) >= date_from)
            elif date_to:
                overlap_conditions.append(Event.date_start <= date_to)
            
            if overlap_conditions:
                 query = query.where(or_(*overlap_conditions))
        else:
            # Default "Upcoming" behavior if no specific range
            # (Matches standard feed behavior)
            query = query.where(func.coalesce(Event.date_end, Event.date_start) >= sql_now)
            
        
        # 5. GET TOTAL COUNT (Before slicing)
        # Efficiently count matches so the frontend knows when to stop "Load More"
        count_query = select(func.count()).select_from(query.distinct().subquery())
        total = session.exec(count_query).one() or 0

        # Sort by active featured first (using the date-gated outerjoin), then date
        # We must join FeaturedBooking here because we re-initialized the query for city_filter
        from datetime import date as date_today
        today = date_today.today()
        query = query.outerjoin(
            FeaturedBooking,
            (FeaturedBooking.event_id == Event.id) &
            (FeaturedBooking.status == BookingStatus.ACTIVE) &
            (FeaturedBooking.start_date <= today) &
            (FeaturedBooking.end_date >= today)
        )
        
        active_featured_priority = case(
            (FeaturedBooking.id.isnot(None), 1),
            else_=0
        ).desc()
        query = query.order_by(active_featured_priority, Event.date_start.asc())
        
        # Execute query without database-level distinct to avoid InvalidColumnReference crash.
        # Deduplicate in Python memory using an item unique dictionary sequence to preserve sorting and structure,
        # then apply skip and limit pagination.
        raw_results = session.exec(query).all()
        seen = {}
        for event in raw_results:
            if event.id not in seen:
                seen[event.id] = event
        results = list(seen.values())[skip : skip + limit]
        print(f"DEBUG: Returned {len(results)} events for '{city_filter}' (Skip: {skip}, Limit: {limit})")
        
        # Build responses
        event_responses = [
            build_event_response(event, session, latitude, longitude, current_user)
            for event in results
        ]
        
        return EventListResponse(
            events=event_responses,
            total=total,
            skip=skip,
            limit=limit
        )

    # --- SCENARIO A: Standard Search (if no city_filter) ---
    elif q:
        search_term = f"%{q}%"
        # Generate slugified version for tag matching (e.g., "Live Music" -> "live-music")
        search_slug = normalize_tag_name(q)
        
        # Track joins to prevent DuplicateAlias
        event_tag_joined = False
        tag_joined = False
        
        # Join with Venue if not already joined
        if not venue_joined:
            query = query.outerjoin(Venue, Event.venue_id == Venue.id)
            venue_joined = True
        
        # Join with EventTag and Tag for tag search if not already joined
        if tag_names or tag:
            event_tag_joined = True
            tag_joined = True
        else:
            query = query.outerjoin(EventTag, Event.id == EventTag.event_id)
            query = query.outerjoin(Tag, EventTag.tag_id == Tag.id)
            event_tag_joined = True
            tag_joined = True
        
        # Join with Category for category name search if not already joined
        category_joined = False
        if category or category_id or category_ids:
            # Not strictly joined in the above logic unless necessary, but safer to assume we might need it
            pass
        else:
            query = query.outerjoin(Category, Event.category_id == Category.id)
            category_joined = True

        
        # Build search conditions
        search_conditions = [
            Event.title.ilike(search_term),
            Event.description.ilike(search_term),
            Event.location_name.ilike(search_term),
            Event.address_full.ilike(search_term),
            Event.postcode.ilike(search_term),
            Venue.name.ilike(search_term),
            Venue.address.ilike(search_term),
            Venue.formatted_address.ilike(search_term),
            Venue.postcode.ilike(search_term)
        ]

        if tag_joined:
            search_conditions.extend([
                Tag.name == search_slug,
                Tag.name.ilike(f"%{search_slug}%")
            ])
            
        if category_joined:
             search_conditions.extend([
                Category.name.ilike(search_term),
                Category.slug.ilike(search_term)
             ])
             
        query = query.where(or_(*search_conditions))

    # Location Search...
    if location and (latitude is None or longitude is None) and not city_filter:
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

    # Filter by date range using OVERLAP logic
    # We apply this directly to Event dates for simplicity and reliability in listings.
    # Showtime-specific filtering is handled by the overall date_end filters above.
    if date_from or date_to:
        overlap_conditions = []
        if date_from and date_to:
            overlap_conditions.append((Event.date_start <= date_to) & (func.coalesce(Event.date_end, Event.date_start) >= date_from))
        elif date_from:
            overlap_conditions.append(func.coalesce(Event.date_end, Event.date_start) >= date_from)
        elif date_to:
            overlap_conditions.append(Event.date_start <= date_to)
        
        if overlap_conditions:
            query = query.where(or_(*overlap_conditions))
    
    # Handle explicit Time Range filters
    if time_range == "past":
        query = query.where(func.coalesce(Event.date_end, Event.date_start) < func.now())
    elif time_range == "week":
        from sqlalchemy import text
        query = query.where(Event.date_start >= func.current_date())
        query = query.where(Event.date_start <= func.current_date() + text("INTERVAL '7 days'"))
    elif time_range == "month":
        from sqlalchemy import text
        query = query.where(Event.date_start >= func.current_date())
        query = query.where(Event.date_start <= func.current_date() + text("INTERVAL '30 days'"))
    elif not include_past:
        # For "Upcoming", we must be very strict: the event or its occurrences must happen in the future
        query = query.where(func.coalesce(Event.date_end, Event.date_start) >= func.now())

    # Filter by recurrence status
    if is_recurring is not None:
        query = query.where(Event.is_recurring == is_recurring)

    # Filter by maximum duration
    if max_duration_days is not None:
        query = query.where(Event.date_end - Event.date_start <= timedelta(days=max_duration_days))

    # Filter by price range
    if price_min is not None:
        query = query.where(Event.price >= price_min)
    if price_max is not None:
        query = query.where(Event.price <= price_max)

    # Filter by featured status (uses date-gated FeaturedBooking outerjoin)
    if featured_only:
        query = query.where(FeaturedBooking.id.isnot(None))

    # Default radius to 20 miles when lat/lng provided but no radius specified
    if latitude is not None and longitude is not None and radius_miles is None:
        radius_miles = 20.0

    # Convert miles to km
    radius_km = radius_miles * 1.60934 if radius_miles is not None else None

    # Filter by geographic proximity (BBox)
    if latitude is not None and longitude is not None and radius_km is not None:
        min_lat, max_lat, min_lon, max_lon = get_bounding_box(latitude, longitude, radius_km)
        
        if not venue_joined:
            query = query.outerjoin(Venue, Event.venue_id == Venue.id)
            venue_joined = True
        
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

    # Filter by organizer profile (group)
    if organizer_profile_id:
        query = query.where(Event.organizer_profile_id == normalize_uuid(organizer_profile_id))

    # Determine if we are performing a radius search (Near Me)
    is_radius_search = latitude is not None and longitude is not None and radius_km is not None
    has_date_filter = date_from is not None or date_to is not None

    events = []
    total = 0

    events, total = deduplicate_recurring_events(
        session=session,
        base_query=query,
        limit=None if is_radius_search else limit,
        offset=0 if is_radius_search else skip,
        order_by_featured=True,
        sort_field=sort_by
    )

    # Apply true Haversine distance filtering
    if is_radius_search:
        events_with_distance = []
        for event in events:
            event_lat = event.latitude
            event_lon = event.longitude
            
            has_event_coords = (
                event_lat is not None and event_lon is not None and 
                (abs(event_lat) > 0.0001 or abs(event_lon) > 0.0001)
            )
            
            if not has_event_coords:
                if event.venue_id:
                    venue = session.get(Venue, event.venue_id)
                    if venue:
                        event_lat = venue.latitude
                        event_lon = venue.longitude

            if event_lat is not None and event_lon is not None:
                dist_km = haversine_distance(latitude, longitude, event_lat, event_lon)
                if dist_km <= radius_km:
                    events_with_distance.append((event, dist_km))
        
        events_with_distance.sort(key=lambda x: x[1])
        filtered_events = [e[0] for e in events_with_distance]
        total = len(filtered_events)
        events = filtered_events[skip : skip + limit]

    event_responses = [
        build_event_response(event, session, latitude, longitude, current_user)
        for event in events
    ]

    return EventListResponse(
        events=event_responses,
        total=total,
        skip=skip,
        limit=limit
    )

# ... (create_event remains similar but with priority fix below) ...

@router.get("/suggestions")
@limiter.limit("30/minute")
def suggest_events(
    request: Request,
    q: str = Query(..., min_length=5, description="Title search query"),
    limit: int = Query(default=5, ge=1, le=10),
    session: Session = Depends(get_session),
):
    """
    Return the top N existing events whose title is similar to `q`.

    Uses PostgreSQL pg_trgm `similarity()` for fuzzy matching.
    Falls back to ILIKE if pg_trgm is not available.
    """
    from sqlalchemy import text as sa_text
    from pydantic import BaseModel
    from typing import Optional

    class SuggestionItem(BaseModel):
        id: str
        title: str
        date_start: datetime
        venue_name: Optional[str] = None

    try:
        # pg_trgm path — ORDER BY similarity DESC
        rows = session.exec(
            sa_text(
                "SELECT e.id, e.title, e.date_start, v.name AS venue_name "
                "FROM events e "
                "LEFT JOIN venues v ON e.venue_id = v.id "
                "WHERE e.status = 'published' "
                "  AND similarity(e.title, :q) > 0.3 "
                "ORDER BY similarity(e.title, :q) DESC "
                "LIMIT :lim"
            ).bindparams(q=q, lim=limit)
        ).all()
    except Exception:
        # Fallback — plain ILIKE (covers SQLite / missing pg_trgm)
        search_term = f"%{q}%"
        rows = session.exec(
            sa_text(
                "SELECT e.id, e.title, e.date_start, v.name AS venue_name "
                "FROM events e "
                "LEFT JOIN venues v ON e.venue_id = v.id "
                "WHERE e.status = 'published' "
                "  AND e.title ILIKE :term "
                "ORDER BY e.date_start DESC "
                "LIMIT :lim"
            ).bindparams(term=search_term, lim=limit)
        ).all()

    return [
        SuggestionItem(
            id=row.id,
            title=row.title,
            date_start=row.date_start,
            venue_name=row.venue_name,
        )
        for row in rows
    ]



@router.post("/{event_id}/click", response_model=EventResponse)
def track_ticket_click(
    event_id: str,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Track a "Get Tickets" click.
    Increments ticket_click_count and returns updated event.
    Public endpoint (no auth required).
    """
    event = session.get(Event, normalize_uuid(event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event.ticket_click_count += 1
    session.add(event)
    session.commit()
    session.refresh(event)
    
    return build_event_response(event, session, current_user=current_user)


@router.post("/{event_id}/website-click", response_model=EventResponse)
def track_website_click(
    event_id: str,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Track an "External Website" click.
    Increments website_click_count and returns updated event.
    Public endpoint (no auth required).
    """
    event = session.get(Event, normalize_uuid(event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event.website_click_count += 1
    session.add(event)
    session.commit()
    session.refresh(event)
    
    return build_event_response(event, session, current_user=current_user)


@router.get("/promoted", response_model=EventListResponse)
def get_promoted_events(
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get promoted (featured) events.
    Returns up to 3 events with an ACTIVE FeaturedBooking whose date range
    includes today. Strictly filters by booking start_date <= today <= end_date.
    """
    from datetime import date as date_type
    today = date_type.today()
    
    query = (
        select(Event)
        .join(
            FeaturedBooking,
            FeaturedBooking.event_id == Event.id
        )
        .where(
            FeaturedBooking.status == BookingStatus.ACTIVE,
            FeaturedBooking.start_date <= today,
            FeaturedBooking.end_date >= today,
            Event.status == "published"
        )
        .order_by(FeaturedBooking.end_date.asc())
    )
    
    # Deduplicate in Python to avoid DISTINCT issues with ORDER BY
    raw_results = session.exec(query).all()
    seen = {}
    for event in raw_results:
        if event.id not in seen:
            seen[event.id] = event
    promoted_events = list(seen.values())[:3]
    
    event_responses = [build_event_response(event, session, current_user=current_user) for event in promoted_events]
    
    return EventListResponse(
        events=event_responses,
        total=len(event_responses),
        skip=0,
        limit=3
    )


@router.get("/top", response_model=EventListResponse)
def get_top_events(
    limit: int = Query(default=10, ge=1, le=50),
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get top events ranked by Velocity Score.
    
    Algorithm:
    1. Raw Score = (view_count * 1) + (attending_count * 5) + (ticket_click_count * 10) + (website_click_count * 5)
    2. Days Live = max(1, days between created_at and today)
    3. Final Score = Raw Score / Days Live
    
    Sorting:
    - Primary: Final Score DESC
    - Secondary: Date ASC (upcoming first)
    """
    # Step 1: Calculate the raw score: (Views * 1) + (Attending * 5) + (Tickets * 10) + (Website * 5)
    raw_score_expr = (
        Event.view_count + 
        (Event.attending_count * 5) + 
        (Event.ticket_click_count * 10) + 
        (Event.website_click_count * 5)
    )
    
    # Step 2: Calculate days live: (current_time - created_at) in days, minimum 1 to avoid /0
    # We use extract('epoch') to get total seconds since creation, then divide by 86400 (seconds in a day)
    days_live_expr = func.greatest(1, func.extract('epoch', func.now() - Event.created_at) / 86400.0)
    
    # Step 3: Velocity Score = Raw Score / Days Live
    velocity_score = raw_score_expr / days_live_expr
    
    # Step 4: Filter by date_end >= today (now) and limit to top 10
    query = select(Event).where(
        (Event.date_end >= func.now()) & # Include ongoing events until they finish
        (Event.status == "published")
    ).order_by(
        velocity_score.desc(),
        Event.date_start.asc()
    ).limit(limit)

    top_events = session.exec(query).all()
    
    # Build responses
    event_responses = [build_event_response(event, session, current_user=current_user) for event in top_events]
    
    return EventListResponse(
        events=event_responses,
        total=len(event_responses),
        skip=0,
        limit=limit
    )


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
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
    
    # 1. Custom Rule Provided? Use it.
    # 1. Custom Rule Provided? Use it.
    if event_data.is_recurring and recurrence_rule:
        # Trust the frontend provided rule - Explicit pass for clarity
        pass
        
    # 2. No Rule? Generate from Frequency (Legacy/Simple Mode)
    elif event_data.is_recurring and event_data.frequency:
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
        map_display_lat=event_data.map_display_lat,
        map_display_lng=event_data.map_display_lng,
        map_display_label=event_data.map_display_label,
    # SEO Overrides
        seo_title=event_data.seo_title,
        seo_description=event_data.seo_description,
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
    # PRIORITY 1: Content Moderation (Offensive/Illegal)
    if is_offensive:
        new_event.status = "pending" # Keep as pending for admin to review/reject? Or rejected?
        # Original code said "pending" with reason.
        new_event.moderation_reason = moderation_reason
        logger.info(f"[PROFANITY_FILTER] Event '{new_event.title}' flagged: {moderation_reason}")
        
    # PRIORITY 2: Duplicate Detection (CRITICAL UPDATE)
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
        logger.info(f"[DUPLICATE_DETECT] Event '{new_event.title}' flagged as duplicate. FORCE STATUS: pending_moderation")

    # PRIORITY 3: External Links (Anti-Spam)
    elif contains_link and not current_user.is_admin and not current_user.is_trusted_organizer:
        new_event.status = "pending"
        new_event.moderation_reason = "Contains External Link"
        logger.info(f"[LINK_WARDEN] Event '{new_event.title}' pending (link detected)")
        
    # PRIORITY 4: Auto-Approval (Trusted Users)
    elif is_auto_approved:
        new_event.status = "published"
        logger.info(f"[AUTO_APPROVE] Event '{new_event.title}' auto-approved.")
        
    # Default: Standard Review
    else:
        new_event.status = "pending"
        logger.info(f"[MODERATION] Event '{new_event.title}' pending (standard review).")
    session.add(new_event)
    try:
        session.flush()  # Get the event ID
    except Exception as e:
        # Check for unique constraint violation
        if "uq_event_title_date_venue" in str(e):
            session.rollback()
            logger.warning(f"[CREATE_EVENT] Duplicate event blocked: {new_event.title}")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An event with this title, date, and venue already exists."
            )
        raise e

    # --- Generate SEO Slug ---
    from app.core.utils import generate_seo_slug
    slug_parts = [generate_seo_slug(new_event.title)]
    # Append venue name for keyword richness
    if venue_id_normalized:
        venue_obj = session.get(Venue, venue_id_normalized)
        if venue_obj:
            slug_parts.append(generate_seo_slug(venue_obj.name, max_length=30))
    elif event_data.location_name:
        slug_parts.append(generate_seo_slug(event_data.location_name, max_length=30))
    # Append month-year
    if new_event.date_start:
        slug_parts.append(new_event.date_start.strftime("%b-%Y").lower())
    base_slug = "-".join(p for p in slug_parts if p)[:300]
    # Collision prevention
    candidate_slug = base_slug
    suffix = 1
    while session.exec(
        select(Event).where(Event.slug == candidate_slug, Event.id != new_event.id)
    ).first():
        candidate_slug = f"{base_slug}-{suffix}"
        suffix += 1
    new_event.slug = candidate_slug

    # Handle tags
    if event_data.tags:
        tags = get_or_create_tags(session, event_data.tags)
        for tag in tags:
            event_tag = EventTag(event_id=new_event.id, tag_id=tag.id)
            session.add(event_tag)
            tag.usage_count += 1
            
    # Apply automated NC500 tagging
    apply_geographic_tagging(session, new_event)
            
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
            # BUG FIX: Check actual status, not just user permission flag.
            # Even trusted users can be flagged for moderation (content/duplicates).
            if new_event.status == 'published':
                # Get venue name for notification
                v_name = new_event.location_name
                if new_event.venue_id:
                    v = session.get(Venue, new_event.venue_id)
                    if v:
                        v_name = v.name

                # Send auto-approval email via Resend
                await resend_email_service.send_event_approved(
                    to_email=current_user.email,
                    event_title=new_event.title,
                    event_id=str(new_event.id),
                    username=current_user.username,
                    is_auto_approved=True
                )
                logger.info(f"Auto-approval email sent to {mask_email(current_user.email)} for event {new_event.id}")
                
                # Send EMAIL alert to ADMIN_EMAIL (New Event Posted)
                background_tasks.add_task(
                    resend_email_service.send_new_event_notification,
                    new_event.title,
                    str(new_event.id),
                    v_name
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
                        current_user.email
                    )
                
                # Send EMAIL alert to ADMIN_EMAIL (New Event Posted)
                background_tasks.add_task(
                    resend_email_service.send_new_event_notification,
                    new_event.title,
                    str(new_event.id),
                    current_user.username or current_user.email
                )
        except Exception as e:
            # Log error but don't fail the request - event creation succeeded
            logger.error(f"Failed to send notification email for event {new_event.id}: {e}")

    return build_event_response(new_event, session, current_user=current_user)


def async_increment_view_count(event_id: str):
    """
    Background worker to safely increment view counts.
    Opens its own isolated database session to prevent detached instance errors
    and row-level locking during high-traffic read operations.
    """
    try:
        from sqlmodel import Session
        with Session(engine) as db:
            from app.models.event import Event
            event = db.get(Event, event_id)
            if event:
                event.view_count += 1
                db.add(event)
                db.commit()
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[ANALYTICS] Failed to increment view count for event {event_id}: {e}")


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: str,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get a specific event by ID or slug.
    Supports dual-resolution: tries slug first, falls back to UUID.
    """
    # Try slug lookup first
    event = session.exec(
        select(Event).where(Event.slug == event_id)
    ).first()

    # Fall back to UUID lookup
    if not event:
        event = session.get(Event, normalize_uuid(event_id))

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # Hand off the write operation to prevent database locks
    background_tasks.add_task(async_increment_view_count, event.id)

    response = build_event_response(event, session, current_user=current_user)
    
    # Explicit "Truth Injection" for RSVP status (Strictly Normalized Match)
    if current_user:
        attendee_record = session.exec(
            select(EventAttendee).where(
                EventAttendee.user_id == current_user.id,
                EventAttendee.event_id == normalize_uuid(event.id)
            )
        ).first()
        response.is_attending = attendee_record is not None

    return response

@router.post("/{event_id}/attend", status_code=status.HTTP_200_OK)
def toggle_attendance(
    event_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Toggle RSVP/Attendance for an event.
    """
    # Resolve event (slug or ID)
    event = session.exec(
        select(Event).where(Event.slug == event_id)
    ).first()
    
    if not event:
        normalized_event_id = normalize_uuid(event_id)
        event = session.get(Event, normalized_event_id)
        
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    norm_event_id = normalize_uuid(event.id)
        
    from app.models.event_attendee import EventAttendee
    attendance = session.exec(
        select(EventAttendee).where(
            EventAttendee.user_id == current_user.id,
            EventAttendee.event_id == norm_event_id
        )
    ).first()
    
    if attendance:
        session.delete(attendance)
        event.attending_count = max(0, (event.attending_count or 0) - 1)
        session.add(event)
        session.commit()
        return {"is_attending": False, "attending_count": event.attending_count, "message": "You are no longer attending this event."}
    else:
        new_attendance = EventAttendee(user_id=current_user.id, event_id=norm_event_id)
        session.add(new_attendance)
        event.attending_count = (event.attending_count or 0) + 1
        session.add(event)
        session.commit()
        return {"is_attending": True, "attending_count": event.attending_count, "message": "You are now attending this event!"}


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
        build_event_response(instance, session, current_user=current_user)
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
async def update_event(
    event_id: str,
    event_data: EventUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    background_tasks: BackgroundTasks = None,
    unlink_venue: bool = Query(False, description="Explicitly allow unlinking a venue (wiping venue_id to None)")
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

    # Prevent destructive scraper wipes for venue_id
    if "venue_id" in update_data and update_data["venue_id"] is None:
        if event.venue_id is not None and not unlink_venue:
            logger.warning(f"[UPDATE_EVENT] Prevented wiping venue_id for event {event.id}. Use unlink_venue=True to force.")
            update_data.pop("venue_id")

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
        # 1. Update RRULE string on parent
        # FIX: Only generate from frequency if NO new recurrence_rule is provided in this update
        # If the frontend sent a custom rule, we trust that above all else.
        new_recurrence_rule_in_update = update_data.get("recurrence_rule")
        
        if new_recurrence_rule_in_update:
             # Use the provided custom rule
             event.recurrence_rule = new_recurrence_rule_in_update
             
        elif new_frequency:
             # Fallback: Geneate from frequency (Simple Mode)
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

    # Handle updates
    
    # Track status changes for notifications
    status_changed_to_published = False
    status_changed_to_rejected = False
    
    # Fields handled explicitly or that shouldn't be set via setattr
    excluded_fields = {
        "tags", "participating_venue_ids", "showtimes", 
        "date_start", "date_end", "is_recurring",
        "weekdays", "recurrence_end_date", "frequency"
    }
    
    for field, value in update_data.items():
        if field in excluded_fields:
            continue
            
        if field in ("venue_id", "organizer_profile_id") and value is not None:
            value = normalize_uuid(value)
            
        if field == "status":
            if not current_user.is_admin:
                # Silently ignore status updates from non-admins, unless owner resetting to pending?
                # Actually, owner edit of rejected event might want to reset to 'pending'.
                # Let's allow owner to set 'pending' if current is 'rejected'.
                if original_status == 'rejected' and value == 'pending':
                    pass # Allow
                else:
                    continue
            
            # Detect transitions
            if value == 'published' and original_status != 'published':
                status_changed_to_published = True
            elif value == 'rejected' and original_status != 'rejected':
                status_changed_to_rejected = True
                
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
        # Get current associations
        current_event_tags = session.exec(
            select(EventTag).where(EventTag.event_id == event.id)
        ).all()
        
        current_tags_map = {et.tag_id: et for et in current_event_tags}
        
        # Get target tags
        new_tags = get_or_create_tags(session, event_data.tags) if event_data.tags else []
        new_tag_ids = {tag.id for tag in new_tags}
        
        # Remove tags that are not in the new list
        for tag_id, et in current_tags_map.items():
            if tag_id not in new_tag_ids:
                old_tag = session.get(Tag, tag_id)
                if old_tag and old_tag.usage_count > 0:
                    old_tag.usage_count -= 1
                session.delete(et)
                
        # Add tags that are not in the current list
        for tag in new_tags:
            if tag.id not in current_tags_map:
                event_tag = EventTag(event_id=event.id, tag_id=tag.id)
                session.add(event_tag)
                tag.usage_count += 1
                
        # Apply automated NC500 tagging
        apply_geographic_tagging(session, event)
    
    event.updated_at = datetime.utcnow()

    # ---------------------------------------------------------
    # Task 4: Recurring Series Propagation (Batch Update)
    # ---------------------------------------------------------
    if event.recurrence_group_id:
        # 1. Bulk Update Basic Fields
        stmt = update(Event).where(
            Event.recurrence_group_id == event.recurrence_group_id,
            Event.id != event.id
        ).values(
            title=event.title,
            description=event.description,
            image_url=event.image_url,
            venue_id=event.venue_id,
            location_name=event.location_name,
            category_id=event.category_id,
            price=event.price,
            price_display=event.price_display,
            min_price=event.min_price,
            # Metadata consistency
            ticket_url=event.ticket_url,
            website_url=event.website_url,
            is_all_day=event.is_all_day,
            age_restriction=event.age_restriction,
            min_age=event.min_age,
            organizer_profile_id=event.organizer_profile_id,
            # Map display
            map_display_lat=event.map_display_lat,
            map_display_lng=event.map_display_lng,
            map_display_label=event.map_display_label,
            # Location
            latitude=event.latitude,
            longitude=event.longitude,
            geohash=event.geohash,
            updated_at=datetime.utcnow()
        )
        session.exec(stmt)
        
        # 2. Sync Tags (if updated in this request)
        if event_data.tags is not None:
             # Find all other event IDs in the group
             other_event_ids = session.exec(select(Event.id).where(
                 Event.recurrence_group_id == event.recurrence_group_id,
                 Event.id != event.id
             )).all()
             
             if other_event_ids:
                 # Delete existing tags for these events
                 session.exec(delete(EventTag).where(EventTag.event_id.in_(other_event_ids)))
                 

                 # Re-apply new tags
                 if event_data.tags: # If tags list is not empty
                     tags_to_apply = get_or_create_tags(session, event_data.tags)
                     
                     for oid in other_event_ids:
                         for tag in tags_to_apply:
                             session.add(EventTag(event_id=oid, tag_id=tag.id))
                             tag.usage_count += 1 
                             session.add(tag)

    # Moderation Logic: 
    # 1. If published event is edited by non-trusted user, revert to pending,
    #    UNLESS the event has an active/pending promotion or is hosted at a verified venue.
    # 2. If rejected event is edited, reset to pending for re-review.
    
    venue_verified = False
    if event.venue_id:
        venue = session.get(Venue, event.venue_id)
        if venue and venue.status == "VERIFIED":
            venue_verified = True

    has_active_promotion = False
    active_promo = session.exec(
        select(FeaturedBooking)
        .where(FeaturedBooking.event_id == event.id)
        .where(FeaturedBooking.status.in_([BookingStatus.ACTIVE, BookingStatus.PENDING_PAYMENT]))
    ).first()
    if active_promo:
        has_active_promotion = True

    should_revert = False
    if original_status == "rejected":
        should_revert = True
    elif original_status == "published":
        is_trusted_user = current_user.is_admin or current_user.is_trusted_organizer
        if not (is_trusted_user or venue_verified or has_active_promotion):
            should_revert = True

    if should_revert:
        event.status = "pending"
        event.moderation_reason = "Edited after rejection/publication"
        logger.info(f"[MODERATION] Event '{event.title}' reset to pending update by user {current_user.id}")
        
        # Trigger Admin Alert (Moderation Required)
        background_tasks.add_task(
            resend_email_service.send_moderation_required_notification,
            event.title,
            str(event.id),
            "Flagged for initial moderation review"
        )

    session.add(event)
    session.commit()
    session.refresh(event)

    # Post-update notifications (Moved from Admin/Manual calls to centralized place)
    try:
        # Get organizer user for emails
        organizer_user = None
        if event.organizer_id:
            organizer_user = session.get(User, event.organizer_id)
            
        if organizer_user and organizer_user.email:
            if status_changed_to_published:
                logger.info(f"Event {event.id} published. Sending approval email to {mask_email(organizer_user.email)}")
                await resend_email_service.send_event_approved(
                    to_email=organizer_user.email,
                    event_title=event.title,
                    event_id=str(event.id),
                    username=organizer_user.username,
                    is_auto_approved=False
                )
            elif status_changed_to_rejected:
                logger.info(f"Event {event.id} rejected. Sending rejection email to {mask_email(organizer_user.email)}")
                await resend_email_service.send_event_rejected(
                    to_email=organizer_user.email,
                    event_title=event.title,
                    event_id=str(event.id),
                    rejection_reason=event.moderation_reason, # Ensure this was set during update!
                    username=organizer_user.username
                )
    except Exception as e:
        logger.error(f"Failed to send event status update emails: {e}")

    return build_event_response(event, session, current_user=current_user)


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
    
    # Track B: Admin "Hard Delete" (Failsafe Cleaning)
    if current_user.is_admin:
        # If this is a recurring parent event, delete all child instances first
        if event.is_recurring and delete_children:
            children = session.exec(
                select(Event).where(Event.parent_event_id == event.id)
            ).all()
            children_deleted = len(children)
            for child in children:
                # Manual cleanup for children to avoid any FK issues before CASCADE kicks in
                from app.models.bookmark import Bookmark
                session.exec(delete(Bookmark).where(Bookmark.event_id == child.id))
                
                # Cleanup other dependencies for child
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
        from app.models.bookmark import Bookmark
        session.exec(delete(Bookmark).where(Bookmark.event_id == event.id))

        featured_bookings = session.exec(select(FeaturedBooking).where(FeaturedBooking.event_id == event.id)).all()
        for fb in featured_bookings:
            session.delete(fb)

        participating_venues = session.exec(select(EventParticipatingVenue).where(EventParticipatingVenue.event_id == event.id)).all()
        for pv in participating_venues:
            session.delete(pv)

        # Cleanup showtimes
        from app.models.showtime import EventShowtime
        showtimes = session.exec(select(EventShowtime).where(EventShowtime.event_id == event.id)).all()
        for st in showtimes:
            session.delete(st)

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
    else:
        # Track A: User "Soft Delete" (Cancellation)
        # Logic: When a non-admin owner deletes an event, it's archived.
        event.status = 'archived'
        
        # If recurring, archive children too
        if event.is_recurring and delete_children:
            session.exec(
                update(Event)
                .where(Event.parent_event_id == event.id)
                .values(status='archived')
            )
            
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
    # Get admins (reuse logic or simple query)
    admin_users = session.exec(select(User).where(User.is_admin == True)).all()
    admin_emails = [u.email for u in admin_users if u.email]
    
    if admin_emails:
        notification_service.notify_admin_new_claim(
            admin_emails, 
            "event", 
            event.title, 
            current_user.email,
            session=session,
            admin_users=admin_users
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
