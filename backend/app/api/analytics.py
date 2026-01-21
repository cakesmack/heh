from datetime import datetime, timedelta, date
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from sqlmodel import Session, select, func, col
from pydantic import BaseModel

from app.core.database import get_session
from app.core.security import get_current_user_optional, get_current_user
from app.models.analytics import AnalyticsEvent
from app.models.user import User
from app.models.event import Event
from app.models.venue import Venue
from app.models.category import Category

router = APIRouter()

# --- Schemas ---

class AnalyticsTrackRequest(BaseModel):
    event_type: str
    url: str
    session_id: str
    metadata: Optional[Dict[str, Any]] = None

class DailyStats(BaseModel):
    date: str
    count: int

class AdminAnalyticsSummary(BaseModel):
    total_views: int
    total_unique_visitors: int
    top_events: List[Dict[str, Any]]
    top_categories: List[Dict[str, Any]]
    content_gaps: List[Dict[str, Any]]
    conversion_rate: float
    total_event_views: int
    total_ticket_clicks: int
    daily_views: List[DailyStats]
    # Growth tracking fields
    previous_total_views: int = 0
    previous_conversion_rate: float = 0.0

class VenueAnalyticsSummary(BaseModel):
    total_views: int
    daily_views: List[DailyStats]
    top_events: List[Dict[str, Any]]

# --- Endpoints ---

@router.post("/track", status_code=status.HTTP_202_ACCEPTED)
async def track_event(
    request: AnalyticsTrackRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Track a user event.
    """
    # Create event object
    event = AnalyticsEvent(
        event_type=request.event_type,
        url=request.url,
        session_id=request.session_id,
        event_metadata=request.metadata,
        user_id=str(current_user.id) if current_user else None,
        created_at=datetime.utcnow()
    )
    
    session.add(event)
    session.commit()
    
    return {"status": "queued"}

@router.get("/summary", response_model=AdminAnalyticsSummary)
def get_admin_summary(
    days: int = 30,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get aggregated analytics for the Admin Dashboard.
    Requires Admin privileges.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    start_date = datetime.utcnow() - timedelta(days=days)

    # 1. Total Views (All types)
    total_views = session.exec(
        select(func.count(AnalyticsEvent.id)).where(AnalyticsEvent.created_at >= start_date)
    ).one()

    # 2. Unique Visitors (Approximate by session_id)
    total_unique = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.session_id))).where(AnalyticsEvent.created_at >= start_date)
    ).one()

    # 3. Top Events (by event_view count)
    event_view_analytics = session.exec(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.event_type == "event_view")
        .where(AnalyticsEvent.created_at >= start_date)
    ).all()
    
    event_views_count = {}
    for a in event_view_analytics:
        if a.event_metadata and 'target_id' in a.event_metadata:
            tid = a.event_metadata['target_id']
            event_views_count[tid] = event_views_count.get(tid, 0) + 1
    
    # Get top 10 event IDs by view count
    sorted_event_views = sorted(event_views_count.items(), key=lambda x: x[1], reverse=True)[:10]
    
    top_events = []
    for event_id, views in sorted_event_views:
        event = session.get(Event, event_id)
        if event:
            top_events.append({
                "id": event_id,
                "title": event.title,
                "views": views
            })

    # 4. Top Categories (by category_click count)
    category_click_analytics = session.exec(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.event_type == "category_click")
        .where(AnalyticsEvent.created_at >= start_date)
    ).all()
    
    category_clicks_count = {}
    for a in category_click_analytics:
        if a.event_metadata and 'target_id' in a.event_metadata:
            cid = a.event_metadata['target_id']
            category_clicks_count[cid] = category_clicks_count.get(cid, 0) + 1
    
    sorted_category_clicks = sorted(category_clicks_count.items(), key=lambda x: x[1], reverse=True)[:5]
    
    from app.models.category import Category
    top_categories = []
    for cat_id, clicks in sorted_category_clicks:
        category = session.get(Category, cat_id)
        if category:
            top_categories.append({
                "name": category.name,
                "clicks": clicks
            })

    # 5. Content Gaps (searches with 0 results)
    # Get all search events and filter by result_count == 0 in Python
    search_events = session.exec(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.event_type == "search")
        .where(AnalyticsEvent.created_at >= start_date)
    ).all()
    
    failed_searches = {}
    for se in search_events:
        if se.event_metadata and se.event_metadata.get('result_count', 1) == 0:
            query = se.event_metadata.get('query', 'unknown')
            if query:
                failed_searches[query] = failed_searches.get(query, 0) + 1
    
    content_gaps = [
        {"query": q, "count": c}
        for q, c in sorted(failed_searches.items(), key=lambda x: x[1], reverse=True)[:10]
    ]

    # 6. Conversion Rate (click_ticket / event_view)
    event_views_total = session.exec(
        select(func.count(AnalyticsEvent.id))
        .where(AnalyticsEvent.event_type == "event_view")
        .where(AnalyticsEvent.created_at >= start_date)
    ).one()
    
    ticket_clicks = session.exec(
        select(func.count(AnalyticsEvent.id))
        .where(AnalyticsEvent.event_type == "click_ticket")
        .where(AnalyticsEvent.created_at >= start_date)
    ).one()
    
    conversion_rate = (ticket_clicks / event_views_total * 100) if event_views_total > 0 else 0.0

    # 8. Previous Period Stats (for growth tracking)
    prev_start_date = start_date - timedelta(days=days)
    
    prev_total_views = session.exec(
        select(func.count(AnalyticsEvent.id))
        .where(AnalyticsEvent.created_at >= prev_start_date)
        .where(AnalyticsEvent.created_at < start_date)
    ).one() or 0

    prev_event_views = session.exec(
        select(func.count(AnalyticsEvent.id))
        .where(AnalyticsEvent.event_type == "event_view")
        .where(AnalyticsEvent.created_at >= prev_start_date)
        .where(AnalyticsEvent.created_at < start_date)
    ).one() or 0

    prev_ticket_clicks = session.exec(
        select(func.count(AnalyticsEvent.id))
        .where(AnalyticsEvent.event_type == "click_ticket")
        .where(AnalyticsEvent.created_at >= prev_start_date)
        .where(AnalyticsEvent.created_at < start_date)
    ).one() or 0

    prev_conversion_rate = (prev_ticket_clicks / prev_event_views * 100) if prev_event_views > 0 else 0.0

    # 7. Daily Views (Last N days)
    logs = session.exec(
        select(AnalyticsEvent.created_at)
        .where(AnalyticsEvent.created_at >= start_date)
    ).all()
    
    daily_counts = {}
    for log_time in logs:
        date_str = log_time.strftime("%Y-%m-%d")
        daily_counts[date_str] = daily_counts.get(date_str, 0) + 1
        
    daily_stats = [
        DailyStats(date=date, count=count) 
        for date, count in sorted(daily_counts.items())
    ]

    return AdminAnalyticsSummary(
        total_views=total_views,
        total_unique_visitors=total_unique,
        top_events=top_events,
        top_categories=top_categories,
        content_gaps=content_gaps,
        conversion_rate=round(conversion_rate, 2),
        total_event_views=event_views_total,
        total_ticket_clicks=ticket_clicks,
        daily_views=daily_stats,
        previous_total_views=prev_total_views,
        previous_conversion_rate=round(prev_conversion_rate, 2)
    )


class MissedOpportunity(BaseModel):
    term: str
    count: int


class MissedOpportunitiesResponse(BaseModel):
    missing_locations: List[MissedOpportunity]
    missing_topics: List[MissedOpportunity]
    total_failed_searches: int


@router.get("/missed-opportunities", response_model=MissedOpportunitiesResponse)
def get_missed_opportunities(
    days: int = 30,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get failed searches (result_count = 0) grouped by type.
    Helps admins identify content gaps for recruitment.
    Requires Admin privileges.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    start_date = datetime.utcnow() - timedelta(days=days)

    # Get all search_query events with result_count = 0
    search_events = session.exec(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.event_type == "search_query")
        .where(AnalyticsEvent.created_at >= start_date)
    ).all()
    
    missing_locations: Dict[str, int] = {}
    missing_topics: Dict[str, int] = {}
    total_failed = 0
    
    for se in search_events:
        if se.event_metadata and se.event_metadata.get('result_count', 1) == 0:
            total_failed += 1
            term = se.event_metadata.get('term', '')
            search_type = se.event_metadata.get('type', 'keyword')
            
            if not term:
                continue
                
            if search_type == 'location':
                missing_locations[term] = missing_locations.get(term, 0) + 1
            else:  # keyword or mixed
                missing_topics[term] = missing_topics.get(term, 0) + 1
    
    # Sort by count and limit to top 100
    sorted_locations = sorted(missing_locations.items(), key=lambda x: x[1], reverse=True)[:100]
    sorted_topics = sorted(missing_topics.items(), key=lambda x: x[1], reverse=True)[:100]
    
    return MissedOpportunitiesResponse(
        missing_locations=[MissedOpportunity(term=t, count=c) for t, c in sorted_locations],
        missing_topics=[MissedOpportunity(term=t, count=c) for t, c in sorted_topics],
        total_failed_searches=total_failed
    )


@router.delete("/missed-opportunities", status_code=status.HTTP_204_NO_CONTENT)
def clear_missed_opportunities(
    admin: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Clear all failed search history.
    Requires Admin privileges.
    """
    if not admin.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete where event_type='search_query' and result_count=0
    # Note: JSON filtering in SQLModel/SQLAlchemy depends on dialect.
    # For simplicity/compatibility, we can fetch IDs and delete, or use raw SQL.
    # Postgres supports jsonb filtering.
    
    # Using fetch-and-delete loop for safety/compatibility or raw sql for speed.
    # Given the volume might be large, raw SQL is better but requires dialect check.
    # Let's use Python filtering for safety if volume isn't massive, or a safer direct Query.
    
    logs = session.exec(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.event_type == "search_query")
    ).all()
    
    deleted_count = 0
    for log in logs:
        if log.event_metadata and log.event_metadata.get('result_count', 1) == 0:
            session.delete(log)
            deleted_count += 1
            
    session.commit()
    
    return None


class OrganizerEventStats(BaseModel):
    event_id: str
    title: str
    views: int
    saves: int
    ticket_clicks: int
    is_series: bool = False


class OrganizerSummary(BaseModel):
    total_views: int
    total_saves: int
    total_ticket_clicks: int
    events: List[OrganizerEventStats]


@router.get("/organizer", response_model=OrganizerSummary)
def get_organizer_stats(
    days: int = 30,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get analytics for events owned by the current user.
    Recurring events are aggregated by parent_event_id.
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Get events owned by this user
    user_events = session.exec(
        select(Event).where(Event.organizer_id == str(current_user.id))
    ).all()
    
    if not user_events:
        return OrganizerSummary(
            total_views=0,
            total_saves=0,
            total_ticket_clicks=0,
            events=[]
        )
    
    # Build mapping: group by parent_event_id for recurring events
    # Key = parent_event_id (or event.id if not a child), Value = {title, event_ids[], is_series}
    # Use string IDs throughout for consistent comparison with analytics target_id
    series_map = {}
    for e in user_events:
        parent_id = str(e.parent_event_id) if e.parent_event_id else str(e.id)
        if parent_id not in series_map:
            # Use the parent event's title, or this event's title if it's the parent
            series_map[parent_id] = {
                "title": e.title,
                "event_ids": [],
                "is_series": e.parent_event_id is not None
            }
        series_map[parent_id]["event_ids"].append(str(e.id))
        if e.parent_event_id:
            series_map[parent_id]["is_series"] = True
    
    all_event_ids = [str(e.id) for e in user_events]
    
    # Fetch analytics for these events
    analytics = session.exec(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.created_at >= start_date)
        .where(AnalyticsEvent.event_type.in_(["event_view", "save_event", "click_ticket"]))
    ).all()
    
    # Aggregate stats per individual event first (use string IDs for comparison)
    raw_stats = {eid: {"views": 0, "saves": 0, "ticket_clicks": 0} for eid in all_event_ids}
    
    for a in analytics:
        if a.event_metadata and 'target_id' in a.event_metadata:
            # Normalize target_id: remove hyphens to match database UUID format
            tid = a.event_metadata['target_id'].replace('-', '')
            if tid in raw_stats:
                if a.event_type == "event_view":
                    raw_stats[tid]["views"] += 1
                elif a.event_type == "save_event":
                    raw_stats[tid]["saves"] += 1
                elif a.event_type == "click_ticket":
                    raw_stats[tid]["ticket_clicks"] += 1
    
    # Aggregate by series
    event_stats = []
    for parent_id, info in series_map.items():
        views = sum(raw_stats.get(eid, {}).get("views", 0) for eid in info["event_ids"])
        saves = sum(raw_stats.get(eid, {}).get("saves", 0) for eid in info["event_ids"])
        clicks = sum(raw_stats.get(eid, {}).get("ticket_clicks", 0) for eid in info["event_ids"])
        
        event_stats.append(OrganizerEventStats(
            event_id=parent_id,
            title=info["title"],
            views=views,
            saves=saves,
            ticket_clicks=clicks,
            is_series=info["is_series"]
        ))
    
    # Sort by views descending
    event_stats.sort(key=lambda x: x.views, reverse=True)
    
    total_views = sum(e.views for e in event_stats)
    total_saves = sum(e.saves for e in event_stats)
    total_clicks = sum(e.ticket_clicks for e in event_stats)
    
    return OrganizerSummary(
        total_views=total_views,
        total_saves=total_saves,
        total_ticket_clicks=total_clicks,
        events=event_stats
    )

@router.get("/trending", response_model=List[str])
def get_trending_events(
    days: int = 7,
    session: Session = Depends(get_session)
):
    """
    Get IDs of events that are currently trending.
    Trending = High growth in views over the last 'days' compared to previous 'days'.
    """
    now = datetime.utcnow()
    current_start = now - timedelta(days=days)
    previous_start = now - timedelta(days=days * 2)

    # 1. Get views for current period
    current_views = session.exec(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.event_type == "event_view")
        .where(AnalyticsEvent.created_at >= current_start)
    ).all()

    current_counts = {}
    for a in current_views:
        if a.event_metadata and 'target_id' in a.event_metadata:
            tid = a.event_metadata['target_id'].replace('-', '')
            current_counts[tid] = current_counts.get(tid, 0) + 1

    # 2. Get views for previous period
    previous_views = session.exec(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.event_type == "event_view")
        .where(AnalyticsEvent.created_at >= previous_start)
        .where(AnalyticsEvent.created_at < current_start)
    ).all()

    previous_counts = {}
    for a in previous_views:
        if a.event_metadata and 'target_id' in a.event_metadata:
            tid = a.event_metadata['target_id'].replace('-', '')
            previous_counts[tid] = previous_counts.get(tid, 0) + 1

    # 3. Calculate growth and identify trending
    trending_ids = []
    for tid, current_count in current_counts.items():
        # Minimum 5 views to be considered trending
        if current_count < 5:
            continue
            
        prev_count = previous_counts.get(tid, 0)
        
        # If 0 previous views, it's trending if it has enough current views
        if prev_count == 0:
            if current_count >= 10:
                trending_ids.append(tid)
            continue
            
        growth = (current_count - prev_count) / prev_count
        if growth >= 0.2:  # 20% growth
            trending_ids.append(tid)

    return trending_ids


# --- New Phase 3: Actionable Insights Endpoints ---

class SupplyGap(BaseModel):
    date: date
    event_count: int

@router.get("/supply-gaps", response_model=List[SupplyGap])
def get_supply_gaps(
    threshold: int = 3,
    days: int = 30,
    session: Session = Depends(get_session)
):
    """
    Identify upcoming dates with low event supply.
    """
    today = date.today()
    end_date = today + timedelta(days=days)
    
    # 1. Generate date range
    date_series = [today + timedelta(days=i) for i in range(days)]
    
    # query active event dates
    events = session.exec(
        select(Event.date_start, Event.date_end)
        .where(Event.date_end >= today)
        .where(Event.date_start <= end_date)
    ).all()
    
    # 3. Map counts
    counts = {d: 0 for d in date_series}
    
    for start, end in events:
        # Normalize to date objects
        s = start.date() if isinstance(start, datetime) else start
        e = end.date() if isinstance(end, datetime) else end
        
        # Clamp to range
        s = max(s, today)
        e = min(e, end_date)
        
        curr = s
        while curr <= e:
            if curr in counts:
                counts[curr] += 1
            curr += timedelta(days=1)
            
    # 4. Filter by threshold
    gaps = [
        SupplyGap(date=d, event_count=c) 
        for d, c in counts.items() 
        if c < threshold
    ]
    
    return sorted(gaps, key=lambda x: x.date)


class QualityIssue(BaseModel):
    issue_type: str  # 'missing_image', 'bad_data', 'missing_location'
    count: int
    event_ids: List[str] # Sample IDs for quick linking

@router.get("/quality-issues", response_model=List[QualityIssue])
def get_quality_issues(
    session: Session = Depends(get_session)
):
    """
    Flag live events with data quality issues.
    """
    today = datetime.utcnow()
    
    # Base query: Active events only
    base_query = select(Event).where(Event.date_end >= today)
    active_events = session.exec(base_query).all()
    
    issues = {
        'missing_image': [],
        'short_description': [],
        'missing_location': []
    }
    
    for event in active_events:
        # Check Image
        if not event.image_url:
            issues['missing_image'].append(event.id)
            
        # Check Description
        if not event.description or len(event.description) < 50:
            issues['short_description'].append(event.id)
            
        # Check Location
        if event.latitude is None or (abs(event.latitude) < 0.0001 and abs(event.longitude) < 0.0001):
            issues['missing_location'].append(event.id)
            
    return [
        QualityIssue(issue_type='missing_image', count=len(issues['missing_image']), event_ids=issues['missing_image'][:5]),
        QualityIssue(issue_type='short_description', count=len(issues['short_description']), event_ids=issues['short_description'][:5]),
        QualityIssue(issue_type='missing_location', count=len(issues['missing_location']), event_ids=issues['missing_location'][:5]),
    ]


@router.get("/quality-issues/details", response_model=List[OrganizerEventStats])
def get_quality_issue_details(
    issue_type: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed list of events for a specific quality issue.
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")

    today = datetime.utcnow()
    
    # Base query: Active events only
    base_query = select(Event).where(Event.date_end >= today)
    active_events = session.exec(base_query).all()
    
    matching_events = []
    
    for event in active_events:
        is_issue = False
        
        if issue_type == 'missing_image':
            if not event.image_url:
                is_issue = True
        elif issue_type == 'short_description':
            if not event.description or len(event.description) < 50:
                is_issue = True
        elif issue_type == 'missing_location':
            if event.latitude is None or (abs(event.latitude) < 0.0001 and abs(event.longitude) < 0.0001):
                is_issue = True
                
        if is_issue:
            # Calculate basic stats (or pass 0 if not needed for this view)
            matching_events.append(OrganizerEventStats(
                event_id=event.id,
                title=event.title,
                views=0, # Not needed for this view
                saves=0,
                ticket_clicks=0,
                is_series=event.parent_event_id is not None
            ))
            
    return matching_events


class CategoryMixStats(BaseModel):
    category_name: str
    count: int
    percentage: float

@router.get("/category-mix", response_model=List[CategoryMixStats])
def get_category_mix(
    session: Session = Depends(get_session)
):
    """
    Breakdown of active inventory by category.
    """
    today = datetime.utcnow()
    
    results = session.exec(
        select(Category.name, func.count(Event.id))
        .join(Event, Event.category_id == Category.id)
        .where(Event.date_end >= today)
        .group_by(Category.name)
    ).all()
    
    total = sum(c for _, c in results)
    
    if total == 0:
        return []
        
    return [
        CategoryMixStats(
            category_name=name,
            count=count,
            percentage=round((count / total) * 100, 1)
        )
        for name, count in results
    ]


@router.get("/top-performers", response_model=List[OrganizerEventStats])
def get_top_performers(
    limit: int = 5,
    days: int = 30,
    session: Session = Depends(get_session)
):
    """
    Top performing events by views/clicks in the last N days.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Fetch raw analytics logs
    logs = session.exec(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.event_type == "event_view")
        .where(AnalyticsEvent.created_at >= cutoff)
    ).all()
    
    # Aggregate counts in Python
    event_counts = {}
    for log in logs:
        if log.event_metadata and "target_id" in log.event_metadata:
            # Normalize ID
            tid = log.event_metadata["target_id"].replace("-", "")
            event_counts[tid] = event_counts.get(tid, 0) + 1
            
    # Sort by views descending
    top_items = sorted(event_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    
    response = []
    for eid, views in top_items:
        event = session.get(Event, eid)
        if event:
            response.append(OrganizerEventStats(
                event_id=eid,
                title=event.title,
                views=views,
                saves=0,
                ticket_clicks=0,
                is_series=event.parent_event_id is not None
            ))
            
    return response
