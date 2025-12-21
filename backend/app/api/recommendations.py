from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func, col, desc

from app.core.database import get_session
from app.core.security import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.event import Event
from app.models.analytics import AnalyticsEvent
from app.models.bookmark import Bookmark
from app.models.follow import Follow
from app.models.tag import Tag, EventTag

router = APIRouter()

@router.get("", response_model=List[Event])
def get_recommendations(
    limit: int = 5,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get personalized event recommendations for the current user.
    Priority:
    1. Events with tags matching saved/viewed events.
    2. Events from followed venues/organizers.
    3. Events in categories they prefer.
    4. Fallback to random popular events.
    
    Note: Already bookmarked events are excluded from recommendations.
    """
    now = datetime.utcnow()
    recommendations: List[Event] = []
    
    # Track series IDs to avoid duplicates from the same recurring series
    # A series ID is parent_event_id if it exists, otherwise the event id itself
    existing_series_ids: List[str] = []
    
    # Group key for deduplication
    group_key = func.coalesce(Event.parent_event_id, Event.id)
    
    # 1. Exclude events the user has already bookmarked (by series)
    user_bookmarks_query = (
        select(group_key)
        .join(Bookmark, Bookmark.event_id == Event.id)
        .where(Bookmark.user_id == current_user.id)
    )
    bookmarked_series_ids = [str(sid) for sid in session.exec(user_bookmarks_query).all()]
    existing_series_ids.extend(bookmarked_series_ids)
    
    # 2. Get tags from bookmarked events
    bookmark_tags_query = (
        select(EventTag.tag_id)
        .join(Event, EventTag.event_id == Event.id)
        .join(Bookmark, Bookmark.event_id == Event.id)
        .where(Bookmark.user_id == current_user.id)
        .distinct()
    )
    preferred_tag_ids = list(session.exec(bookmark_tags_query).all())
    
    # 3. Get tags from recently viewed events
    analytics_query = (
        select(AnalyticsEvent)
        .where(AnalyticsEvent.user_id == str(current_user.id))
        .where(AnalyticsEvent.event_type == "event_view")
        .order_by(AnalyticsEvent.created_at.desc())
        .limit(20)
    )
    recent_views = session.exec(analytics_query).all()
    
    viewed_event_ids = []
    for view in recent_views:
        if view.event_metadata and 'target_id' in view.event_metadata:
            viewed_event_ids.append(view.event_metadata['target_id'])
    
    if viewed_event_ids:
        viewed_tags_query = (
            select(EventTag.tag_id)
            .where(col(EventTag.event_id).in_(viewed_event_ids))
            .distinct()
        )
        viewed_tag_ids = list(session.exec(viewed_tags_query).all())
        preferred_tag_ids = list(set(preferred_tag_ids + viewed_tag_ids))
    
    # 4. Get events matching preferred tags
    if preferred_tag_ids and len(recommendations) < limit:
        tag_events_query = (
            select(Event)
            .join(EventTag, EventTag.event_id == Event.id)
            .where(Event.status == "published")
            .where(Event.date_start >= now)
            .where(col(EventTag.tag_id).in_(preferred_tag_ids))
            .where(group_key.notin_(existing_series_ids) if existing_series_ids else True)
            .group_by(group_key)
            .order_by(Event.featured.desc(), func.min(Event.date_start))
            .limit(limit - len(recommendations))
        )
        tag_events = list(session.exec(tag_events_query).all())
        recommendations.extend(tag_events)
        existing_series_ids.extend([str(e.parent_event_id or e.id) for e in tag_events])
    
    # 5. Get events from followed venues/organizers
    if len(recommendations) < limit:
        follows_query = (
            select(Follow)
            .where(Follow.follower_id == current_user.id)
        )
        user_follows = session.exec(follows_query).all()
        
        followed_venue_ids = [f.target_id for f in user_follows if f.target_type == 'venue']
        followed_organizer_ids = [f.target_id for f in user_follows if f.target_type == 'group']
        
        if followed_venue_ids or followed_organizer_ids:
            conditions = []
            if followed_venue_ids:
                conditions.append(col(Event.venue_id).in_(followed_venue_ids))
            if followed_organizer_ids:
                conditions.append(col(Event.organizer_profile_id).in_(followed_organizer_ids))
            
            from sqlalchemy import or_
            follow_events_query = (
                select(Event)
                .where(Event.status == "published")
                .where(Event.date_start >= now)
                .where(or_(*conditions) if conditions else True)
                .where(group_key.notin_(existing_series_ids) if existing_series_ids else True)
                .group_by(group_key)
                .order_by(Event.featured.desc(), func.min(Event.date_start))
                .limit(limit - len(recommendations))
            )
            follow_events = list(session.exec(follow_events_query).all())
            recommendations.extend(follow_events)
            existing_series_ids.extend([str(e.parent_event_id or e.id) for e in follow_events])
    
    # 6. Get events in preferred categories
    if len(recommendations) < limit:
        # Categories from bookmarks
        bookmark_cat_query = (
            select(Event.category_id)
            .join(Bookmark)
            .where(Bookmark.user_id == current_user.id)
            .distinct()
        )
        preferred_categories = list(session.exec(bookmark_cat_query).all())
        
        # Categories from views
        if viewed_event_ids:
            viewed_cat_query = (
                select(Event.category_id)
                .where(col(Event.id).in_(viewed_event_ids))
                .distinct()
            )
            viewed_categories = list(session.exec(viewed_cat_query).all())
            preferred_categories = list(set(preferred_categories + viewed_categories))
        
        if preferred_categories:
            cat_events_query = (
                select(Event)
                .where(Event.status == "published")
                .where(Event.date_start >= now)
                .where(col(Event.category_id).in_(preferred_categories))
                .where(group_key.notin_(existing_series_ids) if existing_series_ids else True)
                .group_by(group_key)
                .order_by(Event.featured.desc(), func.min(Event.date_start))
                .limit(limit - len(recommendations))
            )
            cat_events = list(session.exec(cat_events_query).all())
            recommendations.extend(cat_events)
            existing_series_ids.extend([str(e.parent_event_id or e.id) for e in cat_events])
    
    # 7. Fallback to random featured/popular events
    if len(recommendations) < limit:
        fallback_query = (
            select(Event)
            .where(Event.status == "published")
            .where(Event.date_start >= now)
            .where(group_key.notin_(existing_series_ids) if existing_series_ids else True)
            .group_by(group_key)
            .order_by(Event.featured.desc(), func.random())
            .limit(limit - len(recommendations))
        )
        fallback_events = list(session.exec(fallback_query).all())
        recommendations.extend(fallback_events)
    
    return recommendations[:limit]


@router.get("/events/{event_id}/similar", response_model=List[Event])
def get_similar_events(
    event_id: str,
    limit: int = 4,
    session: Session = Depends(get_session),
):
    """
    Get similar events based on category OR matching tags.
    Priority:
    1. Same category (most relevant)
    2. Matching tags
    3. Same venue
    4. Fallback to generic upcoming events
    """
    # Normalize event_id by removing hyphens if present
    normalized_event_id = event_id.replace("-", "") if "-" in event_id else event_id
    
    # Get source event
    event = session.get(Event, normalized_event_id)
    if not event:
        return []
        
    now = datetime.utcnow()
    similar_events: List[Event] = []
    
    # Track series IDs to avoid duplicates from the same recurring series
    # A series ID is parent_event_id if it exists, otherwise the event id itself
    existing_series_ids: List[str] = []
    
    # Group key for deduplication
    group_key = func.coalesce(Event.parent_event_id, Event.id)
    
    # Exclude the source event's series from recommendations
    source_series_id = str(event.parent_event_id or event.id)
    existing_series_ids.append(source_series_id)
    
    # 1. First try: Same category
    if event.category_id:
        category_query = (
            select(Event)
            .where(Event.status == "published")
            .where(Event.date_start >= now)
            .where(Event.category_id == event.category_id)
            .where(group_key.notin_(existing_series_ids))
            .group_by(group_key)
            .order_by(func.min(Event.date_start))
            .limit(limit)
        )
        cat_events = list(session.exec(category_query).all())
        similar_events.extend(cat_events)
        existing_series_ids.extend([str(e.parent_event_id or e.id) for e in cat_events])
    
    # 2. Second try: Matching tags
    if len(similar_events) < limit:
        # Get tags from source event
        source_tag_ids_query = (
            select(EventTag.tag_id)
            .where(EventTag.event_id == normalized_event_id)
        )
        source_tag_ids = list(session.exec(source_tag_ids_query).all())
        
        if source_tag_ids:
            remaining = limit - len(similar_events)
            tag_events_query = (
                select(Event)
                .join(EventTag, EventTag.event_id == Event.id)
                .where(Event.status == "published")
                .where(Event.date_start >= now)
                .where(col(EventTag.tag_id).in_(source_tag_ids))
                .where(group_key.notin_(existing_series_ids))
                .group_by(group_key)
                .order_by(func.min(Event.date_start))
                .limit(remaining)
            )
            tag_events = list(session.exec(tag_events_query).all())
            similar_events.extend(tag_events)
            existing_series_ids.extend([str(e.parent_event_id or e.id) for e in tag_events])
    
    # 3. Third try: Same venue
    if len(similar_events) < limit and event.venue_id:
        remaining = limit - len(similar_events)
        venue_query = (
            select(Event)
            .where(Event.status == "published")
            .where(Event.date_start >= now)
            .where(Event.venue_id == event.venue_id)
            .where(group_key.notin_(existing_series_ids))
            .group_by(group_key)
            .order_by(func.min(Event.date_start))
            .limit(remaining)
        )
        venue_events = list(session.exec(venue_query).all())
        similar_events.extend(venue_events)
        existing_series_ids.extend([str(e.parent_event_id or e.id) for e in venue_events])
        
    # 4. Fallback: Generic upcoming events
    if len(similar_events) < limit:
        remaining = limit - len(similar_events)
        fallback_query = (
            select(Event)
            .where(Event.status == "published")
            .where(Event.date_start >= now)
            .where(group_key.notin_(existing_series_ids))
            .group_by(group_key)
            .order_by(Event.featured.desc(), func.min(Event.date_start))
            .limit(remaining)
        )
        fallback_events = list(session.exec(fallback_query).all())
        similar_events.extend(fallback_events)
        
    return similar_events[:limit]
