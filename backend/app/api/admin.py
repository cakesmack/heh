"""
Admin API routes.
Dashboard stats, user management, and moderation endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.venue import Venue
from app.models.checkin import CheckIn
from app.models.venue_claim import VenueClaim
from app.models.report import Report
from app.models.organizer import Organizer
from app.schemas.venue_claim import VenueClaimResponse
from app.services.notifications import notification_service

router = APIRouter(tags=["Admin"])


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

class AdminDashboardStats(BaseModel):
    total_users: int
    total_events: int
    total_venues: int
    total_organizers: int
    upcoming_events: int
    past_events: int
    total_checkins: int
    pending_reports: int
    pending_events: int
    pending_claims: int


class AdminUserResponse(BaseModel):
    id: str
    email: str
    is_admin: bool
    created_at: datetime
    event_count: int
    checkin_count: int


class AdminUserListResponse(BaseModel):
    users: List[AdminUserResponse]
    total: int
    skip: int
    limit: int


# ============================================================
# DASHBOARD STATS
# ============================================================

@router.get("/stats", response_model=AdminDashboardStats)
def get_admin_stats(
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Get dashboard statistics for admin panel."""
    now = datetime.utcnow()

    # Total users
    total_users = session.exec(select(func.count(User.id))).one()

    # Total events
    total_events = session.exec(select(func.count(Event.id))).one()

    # Total venues
    total_venues = session.exec(select(func.count(Venue.id))).one()

    # Total organizers (groups)
    total_organizers = session.exec(select(func.count(Organizer.id))).one()

    # Upcoming events
    upcoming_events = session.exec(
        select(func.count(Event.id)).where(Event.date_start > now)
    ).one()

    # Past events
    past_events = session.exec(
        select(func.count(Event.id)).where(Event.date_end < now)
    ).one()

    # Total check-ins
    total_checkins = session.exec(select(func.count(CheckIn.id))).one()

    # Pending Reports
    pending_reports = session.exec(select(func.count(Report.id)).where(Report.status == "pending")).one()

    # Pending Events
    pending_events = session.exec(select(func.count(Event.id)).where(Event.status == "pending")).one()

    # Pending Claims
    pending_claims = session.exec(select(func.count(VenueClaim.id)).where(VenueClaim.status == "pending")).one()

    return AdminDashboardStats(
        total_users=total_users or 0,
        total_events=total_events or 0,
        total_venues=total_venues or 0,
        total_organizers=total_organizers or 0,
        upcoming_events=upcoming_events or 0,
        past_events=past_events or 0,
        total_checkins=total_checkins or 0,
        pending_reports=pending_reports or 0,
        pending_events=pending_events or 0,
        pending_claims=pending_claims or 0,
    )


# ============================================================
# USER MANAGEMENT
# ============================================================

@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    q: Optional[str] = Query(None, description="Search by email"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """List all users with search and pagination."""
    query = select(User)

    if q:
        query = query.where(User.email.ilike(f"%{q}%"))

    query = query.order_by(User.created_at.desc())

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = session.exec(count_query).one()

    # Apply pagination
    query = query.offset(skip).limit(limit)
    users = session.exec(query).all()

    # Build response with counts
    user_responses = []
    for user in users:
        # Count events by this user
        event_count = session.exec(
            select(func.count(Event.id)).where(Event.organizer_id == user.id)
        ).one() or 0

        # Count check-ins by this user
        checkin_count = session.exec(
            select(func.count(CheckIn.id)).where(CheckIn.user_id == user.id)
        ).one() or 0

        user_responses.append(AdminUserResponse(
            id=str(user.id),
            email=user.email,
            is_admin=user.is_admin,
            created_at=user.created_at,
            event_count=event_count,
            checkin_count=checkin_count,
        ))

    return AdminUserListResponse(
        users=user_responses,
        total=total or 0,
        skip=skip,
        limit=limit,
    )


@router.get("/users/{user_id}", response_model=AdminUserResponse)
def get_user(
    user_id: str,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Get user details by ID."""
    # Normalize user_id by removing hyphens if present
    normalized_id = user_id.replace("-", "") if "-" in user_id else user_id

    user = session.get(User, normalized_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Count events
    event_count = session.exec(
        select(func.count(Event.id)).where(Event.organizer_id == user.id)
    ).one() or 0

    # Count check-ins
    checkin_count = session.exec(
        select(func.count(CheckIn.id)).where(CheckIn.user_id == user.id)
    ).one() or 0

    return AdminUserResponse(
        id=str(user.id),
        email=user.email,
        is_admin=user.is_admin,
        created_at=user.created_at,
        event_count=event_count,
        checkin_count=checkin_count,
    )


@router.post("/users/{user_id}/toggle-admin", response_model=AdminUserResponse)
def toggle_user_admin(
    user_id: str,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Toggle admin status for a user."""
    # Normalize user_id by removing hyphens if present
    normalized_id = user_id.replace("-", "") if "-" in user_id else user_id

    user = session.get(User, normalized_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent self-demotion
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own admin status"
        )

    user.is_admin = not user.is_admin
    session.add(user)
    session.commit()
    session.refresh(user)

    # Count events
    event_count = session.exec(
        select(func.count(Event.id)).where(Event.organizer_id == user.id)
    ).one() or 0

    # Count check-ins
    checkin_count = session.exec(
        select(func.count(CheckIn.id)).where(CheckIn.user_id == user.id)
    ).one() or 0

    return AdminUserResponse(
        id=str(user.id),
        email=user.email,
        is_admin=user.is_admin,
        created_at=user.created_at,
        event_count=event_count,
        checkin_count=checkin_count,
    )


# ============================================================
# VENUE CLAIMS
# ============================================================

@router.get("/claims", response_model=List[VenueClaimResponse])
def list_venue_claims(
    status_filter: Optional[str] = Query(None, alias="status"),
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """List venue ownership claims."""
    query = select(VenueClaim)
    if status_filter:
        query = query.where(VenueClaim.status == status_filter)
    query = query.order_by(VenueClaim.created_at.desc())
    return session.exec(query).all()


@router.post("/claims/{claim_id}/{action}", response_model=VenueClaimResponse)
def process_venue_claim(
    claim_id: int,
    action: str,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Approve or reject a venue claim."""
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid action")
        
    claim = session.get(VenueClaim, claim_id)
    if not claim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
        
    if claim.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Claim is not pending")
        
    claim.status = "approved" if action == "approve" else "rejected"
    claim.updated_at = datetime.utcnow()
    
    if action == "approve":
        venue = session.get(Venue, claim.venue_id)
        if venue:
            venue.owner_id = claim.user_id
            session.add(venue)
            
    session.add(claim)
    session.commit()
    session.refresh(claim)
    
    # Send Notification
    if claim.user and claim.user.email:
        venue_name = claim.venue.name if claim.venue else "Unknown Venue"
        notification_service.notify_venue_claim_update(claim.user.email, venue_name, claim.status)
        
    return claim
