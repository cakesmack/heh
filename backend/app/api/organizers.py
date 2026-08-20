from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.utils import normalize_uuid, simple_slugify
from app.models.user import User
from app.models.organizer import Organizer
from app.models.event import Event
from app.models.follow import Follow
from app.models.group_member import GroupMember, GroupRole
from app.schemas.organizer import (
    OrganizerCreate,
    OrganizerUpdate,
    OrganizerResponse,
    OrganizerListResponse
)

router = APIRouter(tags=["Organizers"])

@router.get("", response_model=OrganizerListResponse)
def list_organizers(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    user_id: Optional[str] = None,
    city: Optional[str] = None,
    group_type: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """
    List organizers with optional filtering.
    """
    # Base query selecting Organizer and counting distinct event titles
    # Outer join ensures we get organizers even if they have zero upcoming events
    query = (
        select(Organizer, func.count(func.distinct(Event.title)).label("computed_count"))
        .outerjoin(
            Event,
            (Event.organizer_profile_id == Organizer.id) &
            (Event.date_end >= datetime.utcnow()) &
            (Event.status == "published") &
            (Event.is_cancelled == False)
        )
    )
    
    # Apply Filters
    if user_id:
        from sqlmodel import or_
        user_uuid = normalize_uuid(user_id)
        member_subquery = select(GroupMember.group_id).where(GroupMember.user_id == user_uuid)
        query = query.where(
            or_(
                Organizer.user_id == user_uuid,
                Organizer.id.in_(member_subquery)
            )
        )
    
    if city:
        query = query.where(Organizer.city == city)
    
    if group_type:
        query = query.where(Organizer.group_type == group_type)

    # Grouping and Sorting
    query = query.group_by(Organizer.id)
    query = query.order_by(func.count(func.distinct(Event.title)).desc(), Organizer.name.asc())

    # Count total (distinct organizers)
    count_query = select(func.count(func.distinct(Organizer.id))).select_from(query.subquery())
    total = session.exec(count_query).one()
    
    # Pagination
    query = query.offset(skip).limit(limit)
    
    # Execute query
    results = session.exec(query).all()
    
    final_organizers = []
    for org, count in results:
        # Populate the field for the response schema
        org.upcoming_events_count = count or 0
        final_organizers.append(org)
    
    return OrganizerListResponse(
        organizers=final_organizers,
        total=total
    )

@router.post("", response_model=OrganizerResponse, status_code=status.HTTP_201_CREATED)
def create_organizer(
    organizer_data: OrganizerCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Create a new organizer profile.
    """
    # Generate slug
    slug = simple_slugify(organizer_data.name)
    
    # Check uniqueness
    existing = session.exec(select(Organizer).where(Organizer.slug == slug)).first()
    if existing:
        # Append random 4 chars
        import random
        import string
        suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
        slug = f"{slug}-{suffix}"
    
    new_organizer = Organizer(
        **organizer_data.model_dump(),
        slug=slug,
        user_id=current_user.id
    )
    
    session.add(new_organizer)
    session.commit()
    session.refresh(new_organizer)
    
    return new_organizer

@router.get("/slug/{slug}", response_model=OrganizerResponse)
def get_organizer_by_slug(
    slug: str,
    session: Session = Depends(get_session)
):
    """
    Get a specific organizer by slug with computed stats.
    """
    organizer = session.exec(select(Organizer).where(Organizer.slug == slug)).first()
    if not organizer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organizer not found"
        )
    
    # Compute upcoming events count (unique titles)
    upcoming_events = session.exec(
        select(func.count(func.distinct(Event.title))).select_from(Event).where(
            Event.organizer_profile_id == organizer.id,
            Event.date_end >= datetime.utcnow(),
            Event.status == "published",
            Event.is_cancelled == False
        )
    ).one() or 0
    
    # Sync with DB if changed
    if organizer.upcoming_events_count != upcoming_events:
        organizer.upcoming_events_count = upcoming_events
        session.add(organizer)
        session.commit()
        session.refresh(organizer)

    # Compute total events hosted (past events only)
    total_events = session.exec(
        select(func.count()).select_from(Event).where(
            Event.organizer_profile_id == organizer.id,
            Event.date_end < datetime.utcnow(),
            Event.status == "published"
        )
    ).one() or 0
    # Build response with computed fields
    response_data = OrganizerResponse.model_validate(organizer)
    response_data.total_events_hosted = total_events
    
    return response_data

@router.get("/{organizer_id}", response_model=OrganizerResponse)
def get_organizer(
    organizer_id: str,
    session: Session = Depends(get_session)
):
    """
    Get a specific organizer by ID.
    """
    organizer = session.get(Organizer, normalize_uuid(organizer_id))
    if not organizer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organizer not found"
        )
    return organizer

@router.put("/{organizer_id}", response_model=OrganizerResponse)
def update_organizer(
    organizer_id: str,
    organizer_data: OrganizerUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Update an organizer profile.
    """
    organizer = session.get(Organizer, normalize_uuid(organizer_id))
    if not organizer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organizer not found"
        )
    
    # Check permissions - OWNER, ADMIN, or site admin can update
    is_creator = organizer.user_id == current_user.id
    is_site_admin = current_user.is_admin
    
    if not is_creator and not is_site_admin:
        # Check if user is OWNER or ADMIN via GroupMember
        member = session.exec(
            select(GroupMember).where(
                GroupMember.group_id == organizer.id,
                GroupMember.user_id == current_user.id,
                GroupMember.role.in_([GroupRole.OWNER, GroupRole.ADMIN])
            )
        ).first()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this organizer"
            )
        
    update_data = organizer_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(organizer, key, value)
        
    organizer.updated_at = datetime.utcnow()
    session.add(organizer)
    session.commit()
    session.refresh(organizer)
    
    return organizer

@router.delete("/{organizer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organizer(
    organizer_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Delete an organizer profile.
    """
    organizer = session.get(Organizer, normalize_uuid(organizer_id))
    if not organizer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organizer not found"
        )
    
    # Check permissions - Only OWNER (creator) or site admin can delete
    if organizer.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group owner can delete this organizer"
        )
        
    # Manual Cascade Delete for related records
    # 1. Delete Members
    from app.models.group_member import GroupMember
    session.exec(select(GroupMember).where(GroupMember.group_id == organizer_id))
    # We need to delete them individually or use delete statements if supported by SQLModel/SQLAlchemy setup
    # Using direct delete statements is more efficient
    from sqlalchemy import delete
    session.exec(delete(GroupMember).where(GroupMember.group_id == organizer_id))
    
    # 2. Delete Invites
    from app.models.group_invite import GroupInvite
    session.exec(delete(GroupInvite).where(GroupInvite.group_id == organizer_id))
    
    # 3. Delete Follows
    from app.models.follow import Follow
    session.exec(delete(Follow).where(Follow.target_id == organizer_id, Follow.target_type == "group"))

    # 4. Delete Organizer
    session.delete(organizer)
    session.commit()
    return None


@router.get("/events")
@router.get("/events/")
def get_organizer_events(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Returns ticketed events owned by the authenticated user or their organization profiles.
    """
    from app.models.order import Order
    from app.models.ticket import Ticket
    from sqlmodel import or_

    organizer_profile_ids = [p.id for p in (getattr(current_user, "organizer_profiles", []) or [])]
    
    query = select(Event).where(Event.is_ticketing_enabled == True)
    
    if not current_user.is_admin:
        conditions = [Event.organizer_id == current_user.id]
        if organizer_profile_ids:
            conditions.append(Event.organizer_profile_id.in_(organizer_profile_ids))
        query = query.where(or_(*conditions))

    events = session.exec(query.order_by(Event.date_start.desc())).all()
    
    results = []
    for ev in events:
        all_tickets = session.exec(
            select(Ticket).join(Order, Ticket.order_id == Order.id).where(Order.event_id == ev.id)
        ).all()
        total_sold = len(all_tickets)
        checked_in = len([t for t in all_tickets if t.status == "checked_in"])
        
        venue_name = ""
        if ev.venue:
            venue_name = ev.venue.name or ""
        elif ev.location_name:
            venue_name = ev.location_name or ""

        is_active = bool(ev.scanner_access_key)
        scanner_url = f"/scan/{ev.id}?token={ev.scanner_access_key}" if is_active else None

        results.append({
            "id": ev.id,
            "event_id": ev.id,
            "title": ev.title,
            "date_start": ev.date_start.isoformat() if ev.date_start else None,
            "date_end": ev.date_end.isoformat() if ev.date_end else None,
            "venue_name": venue_name,
            "image_url": ev.image_url,
            "sales_frozen": ev.sales_frozen,
            "is_cancelled": getattr(ev, "is_cancelled", False),
            "cancellation_reason": getattr(ev, "cancellation_reason", None),
            "cancelled_at": ev.cancelled_at.isoformat() if getattr(ev, "cancelled_at", None) else None,
            "is_scanner_active": is_active,
            "scanner_access_key": ev.scanner_access_key,
            "scanner_url": scanner_url,
            "total_tickets_sold": total_sold,
            "total_checked_in": checked_in,
        })

    return {"events": results}


class EventCancellationRequest(BaseModel):
    reason: Optional[str] = None


@router.post("/events/{event_id}/cancel")
@router.post("/events/{event_id}/cancel/")
def cancel_organizer_event(
    event_id: str,
    request_data: Optional[EventCancellationRequest] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Cancels an event, stops ticket sales, automatically issues face-value refunds for all paid orders,
    cancels free RSVPs, and dispatches email notifications to buyers.
    """
    from app.models.organizer import Organizer
    from app.models.group_member import GroupMember

    event = session.get(Event, normalize_uuid(event_id)) or session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    user_id_str = str(current_user.id).replace('-', '')
    organizer_id_str = str(event.organizer_id).replace('-', '') if event.organizer_id else ''
    
    # Check if user is organizer, venue owner, group admin/member, or platform admin
    is_owner = user_id_str == organizer_id_str
    if not is_owner and event.venue_id:
        from app.models.venue import Venue
        venue = session.get(Venue, event.venue_id)
        if venue and str(getattr(venue, "owner_id", "")).replace('-', '') == user_id_str:
            is_owner = True

    if not is_owner and event.organizer_profile_id:
        member = session.exec(
            select(GroupMember).where(
                GroupMember.group_id == event.organizer_profile_id,
                GroupMember.user_id == current_user.id
            )
        ).first()
        if member:
            is_owner = True

    if not is_owner and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this event")

    if event.is_cancelled:
        return {
            "success": True,
            "message": "Event is already cancelled",
            "event_id": event.id,
            "is_cancelled": True
        }

    reason = request_data.reason if request_data else None
    from app.services.stripe_service import process_event_cancellation_and_refunds
    result = process_event_cancellation_and_refunds(str(event.id), reason=reason, session=session)
    return result


@router.get("/invoices")
@router.get("/invoices/")
def get_organizer_invoices_route(
    event_id: Optional[str] = None,
    tax_year: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Returns platform fee line items and net payout summaries for the organizer's events.
    """
    from app.api.organizer_ticketing import get_organizer_invoices
    return get_organizer_invoices(event_id=event_id, tax_year=tax_year, current_user=current_user, session=session)

