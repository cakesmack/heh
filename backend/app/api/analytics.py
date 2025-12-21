from datetime import datetime, timedelta
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
