"""
Admin API routes.
Dashboard stats, user management, and moderation endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, func, or_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.venue import Venue, VenueStatus
from app.models.checkin import CheckIn
from app.models.venue_claim import VenueClaim
from app.models.venue_invite import VenueInvite
from app.models.venue_staff import VenueStaff, VenueRole
from app.models.event_claim import EventClaim
from app.models.report import Report
from app.models.organizer import Organizer
from app.models.featured_booking import FeaturedBooking, BookingStatus, SlotType
from app.models.slot_pricing import SlotPricing, DEFAULT_PRICING
from app.schemas.venue_claim import VenueClaimResponse
from app.services.notifications import notification_service
from app.services.resend_email import resend_email_service
from app.core.config import settings
import stripe

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
    is_trusted_organizer: bool
    is_active: bool
    has_password: bool  # True = Email login, False = Google login
    created_at: datetime
    event_count: int
    checkin_count: int
    username: str


class AdminUserListResponse(BaseModel):
    users: List[AdminUserResponse]
    total: int
    skip: int
    limit: int


class UserEventSummary(BaseModel):
    id: str
    title: str
    date_start: datetime
    status: str
    image_url: Optional[str]
    is_recurring: bool


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
# ADMIN EVENTS MANAGEMENT
# ============================================================

class AdminEventResponse(BaseModel):
    """Simplified event response for admin list."""
    id: str
    title: str
    status: Optional[str]
    date_start: datetime
    date_end: datetime
    venue_name: Optional[str]
    location_name: Optional[str]
    category_id: Optional[str]
    category_name: Optional[str]
    image_url: Optional[str]
    featured: bool
    is_recurring: bool
    parent_event_id: Optional[str]
    organizer_email: Optional[str]
    created_at: datetime


class AdminEventsListResponse(BaseModel):
    """Paginated admin events response."""
    data: List[AdminEventResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("/events", response_model=AdminEventsListResponse)
def list_admin_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    category_id: Optional[str] = None,
    venue_id: Optional[str] = None,
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    include_past: bool = False,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """List events for admin with pagination and filters."""
    from app.models.category import Category
    
    now = datetime.utcnow()
    
    # Base query
    query = select(Event)
    
    # Apply filters
    if category_id:
        query = query.where(Event.category_id == category_id)
    
    if venue_id:
        try:
            # Handle potential dashed vs dashless mismatch in DB
            u = uuid.UUID(venue_id)
            query = query.where(Event.venue_id.in_([u.hex, str(u)]))
        except ValueError:
            query = query.where(Event.venue_id == venue_id)
    
    if status_filter:
        query = query.where(Event.status == status_filter.lower())
    
    if search:
        search_term = f"%{search}%"
        # Enable searching by venue name
        query = query.outerjoin(Venue)
        
        query = query.where(
            or_(
                Event.title.ilike(search_term),
                Event.description.ilike(search_term),
                Event.location_name.ilike(search_term),
                Venue.name.ilike(search_term)
            )
        )
    
    # Filter out child events (show only parents/singles) for cleaner list
    # Unless searching, we might want to see everything? 
    # User requested: "recurring events only display the parent event here"
    if not search:
        query = query.where(Event.parent_event_id == None)

    if not include_past:
        # Show event if it is in future OR if it is a parent of a future event (active series)
        # This handles the case where the "Series Parent" is past, but the series has future instances.
        future_child_parents = select(Event.parent_event_id).where(Event.date_end >= now).where(Event.parent_event_id != None)
        
        query = query.where(
            or_(
                Event.date_end >= now,
                Event.id.in_(future_child_parents)
            )
        )
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = session.exec(count_query).one()
    
    # Calculate pagination
    offset = (page - 1) * page_size
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    
    # Apply ordering and pagination
    query = query.order_by(Event.date_start.asc())
    query = query.offset(offset).limit(page_size)
    
    events = session.exec(query).all()
    
    # Build response
    result = []
    for event in events:
        # Get category name
        category_name = None
        if event.category_id:
            category = session.get(Category, event.category_id)
            if category:
                category_name = category.name
        
        # Get venue name
        venue_name = None
        if event.venue_id:
            venue = session.get(Venue, event.venue_id)
            if venue:
                venue_name = venue.name
        
        # Get organizer email
        organizer_email = None
        if event.organizer_id:
            user = session.get(User, event.organizer_id)
            if user:
                organizer_email = user.email
        
        result.append(AdminEventResponse(
            id=event.id,
            title=event.title,
            status=event.status,
            date_start=event.date_start,
            date_end=event.date_end,
            venue_name=venue_name,
            location_name=event.location_name,
            category_id=event.category_id,
            category_name=category_name,
            image_url=event.image_url,
            featured=event.featured or False,
            is_recurring=event.is_recurring or False,
            parent_event_id=event.parent_event_id,
            organizer_email=organizer_email,
            created_at=event.created_at
        ))
    
    return AdminEventsListResponse(
        data=result,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
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
            is_trusted_organizer=user.is_trusted_organizer,
            is_active=user.is_active,
            has_password=user.password_hash is not None,
            created_at=user.created_at,
            event_count=event_count,
            checkin_count=checkin_count,
            username=user.username,
        ))

    return AdminUserListResponse(
        users=user_responses,
        total=total or 0,
        skip=skip,
        limit=limit,
    )


@router.post("/users/{user_id}/trusted", response_model=AdminUserResponse)
def toggle_trusted_organizer(
    user_id: str,
    trusted: bool = Query(...),
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Toggle trusted organizer status."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_trusted_organizer = trusted
    session.add(user)
    session.commit()
    session.refresh(user)
    
    # Calculate stats for response
    event_count = session.exec(select(func.count(Event.id)).where(Event.organizer_id == user.id)).one() or 0
    checkin_count = session.exec(select(func.count(CheckIn.id)).where(CheckIn.user_id == user.id)).one() or 0
    
    return AdminUserResponse(
        id=str(user.id),
        email=user.email,
        is_admin=user.is_admin,
        is_trusted_organizer=user.is_trusted_organizer,
        is_active=user.is_active,
        has_password=bool(user.password_hash),
        created_at=user.created_at,
        event_count=event_count,
        checkin_count=checkin_count,
        username=user.username,
    )


@router.get("/users/{user_id}/events", response_model=List[UserEventSummary])
def get_user_events_history(
    user_id: str,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Get event history for a user (de-duplicated for recurrence)."""
    # Fetch all events for this user, ordered by start date
    query = select(Event).where(Event.organizer_id == user_id).order_by(Event.date_start)
    events = session.exec(query).all()
    
    results = []
    seen_groups = set()
    
    for event in events:
        # If part of a recurrence group
        if event.recurrence_group_id:
            if event.recurrence_group_id in seen_groups:
                continue
            seen_groups.add(event.recurrence_group_id)
            
        results.append(UserEventSummary(
            id=event.id,
            title=event.title,
            date_start=event.date_start,
            status=event.status or 'draft',
            image_url=event.image_url,
            is_recurring=event.is_recurring or False
        ))
        
    return results



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
        is_trusted_organizer=user.is_trusted_organizer,
        is_active=user.is_active,
        has_password=user.password_hash is not None,
        created_at=user.created_at,
        event_count=event_count,
        checkin_count=checkin_count,
        username=user.username,
    )


class AdminUserUpdate(BaseModel):
    """Schema for updating user fields."""
    email: Optional[str] = None
    username: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


@router.put("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: str,
    user_update: AdminUserUpdate,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Update user details."""
    normalized_id = user_id.replace("-", "") if "-" in user_id else user_id
    
    user = session.get(User, normalized_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent changing own admin status
    if user_update.is_admin is not None and user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own admin status"
        )
    
    # Update fields
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    session.add(user)
    session.commit()
    session.refresh(user)
    
    # Count events and check-ins
    event_count = session.exec(
        select(func.count(Event.id)).where(Event.organizer_id == user.id)
    ).one() or 0
    checkin_count = session.exec(
        select(func.count(CheckIn.id)).where(CheckIn.user_id == user.id)
    ).one() or 0
    
    return AdminUserResponse(
        id=str(user.id),
        email=user.email,
        is_admin=user.is_admin,
        is_trusted_organizer=user.is_trusted_organizer,
        is_active=user.is_active,
        has_password=user.password_hash is not None,
        created_at=user.created_at,
        event_count=event_count,
        checkin_count=checkin_count,
        username=user.username,
    )


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Delete a user account and all related data."""
    from app.models.bookmark import Bookmark
    from app.models.follow import Follow
    from app.models.group_member import GroupMember
    from app.models.checkin import CheckIn
    from app.models.venue_staff import VenueStaff
    from app.models.venue_claim import VenueClaim
    from app.models.password_reset import PasswordResetToken
    
    normalized_id = user_id.replace("-", "") if "-" in user_id else user_id
    
    user = session.get(User, normalized_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent self-deletion
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Delete related data first (cascade)
    # Bookmarks
    bookmarks = session.exec(select(Bookmark).where(Bookmark.user_id == normalized_id)).all()
    for b in bookmarks:
        session.delete(b)
    
    # Follows
    follows = session.exec(select(Follow).where(Follow.follower_id == normalized_id)).all()
    for f in follows:
        session.delete(f)
    
    # Group memberships
    memberships = session.exec(select(GroupMember).where(GroupMember.user_id == normalized_id)).all()
    for m in memberships:
        session.delete(m)
    
    # Check-ins
    checkins = session.exec(select(CheckIn).where(CheckIn.user_id == normalized_id)).all()
    for c in checkins:
        session.delete(c)
    
    # Venue staff
    staff = session.exec(select(VenueStaff).where(VenueStaff.user_id == normalized_id)).all()
    for s in staff:
        session.delete(s)
    
    # Venue claims
    claims = session.exec(select(VenueClaim).where(VenueClaim.user_id == normalized_id)).all()
    for cl in claims:
        session.delete(cl)
    
    # Password reset tokens
    tokens = session.exec(select(PasswordResetToken).where(PasswordResetToken.email == user.email)).all()
    for t in tokens:
        session.delete(t)
    
    # Now delete the user
    session.delete(user)
    session.commit()
    
    return {"ok": True, "message": f"User {user.email} deleted"}


@router.post("/users/{user_id}/send-password-reset")
def send_user_password_reset(
    user_id: str,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Send password reset email to a user (admin-triggered)."""
    from app.models.password_reset import PasswordResetToken
    from app.core.security import hash_password
    from app.services.email_service import send_password_reset_email
    import secrets
    from datetime import timedelta
    from app.core.config import settings
    
    normalized_id = user_id.replace("-", "") if "-" in user_id else user_id
    
    user = session.get(User, normalized_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Delete existing tokens for this user
    existing_tokens = session.exec(
        select(PasswordResetToken).where(PasswordResetToken.email == user.email)
    ).all()
    for token in existing_tokens:
        session.delete(token)
    
    # Generate new token
    raw_token = secrets.token_urlsafe(32)
    hashed_token = hash_password(raw_token)
    expires_at = datetime.utcnow() + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)
    
    reset_token = PasswordResetToken(
        email=user.email,
        token=hashed_token,
        expires_at=expires_at
    )
    session.add(reset_token)
    session.commit()
    
    # Send email
    email_sent = send_password_reset_email(user.email, raw_token)
    
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send password reset email"
        )
    
    return {"ok": True, "message": f"Password reset email sent to {user.email}"}


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
        # 1. Moderation Check: Ensure user is active
        # Attempt to load user if not present (although relationship should handle it)
        if not claim.user:
             claim.user = session.get(User, claim.user_id)
             
        if not claim.user or not claim.user.is_active:
             raise HTTPException(status_code=400, detail="Cannot approve claim for inactive or banned user")

        venue = session.get(Venue, claim.venue_id)
        if venue:
            # 2. Transfer Ownership
            venue.owner_id = claim.user_id
            session.add(venue)
            
            # 3. Staff Roster Sync
            # Check if new owner is already staff
            existing_staff = session.exec(
                select(VenueStaff).where(
                    VenueStaff.venue_id == venue.id,
                    VenueStaff.user_id == claim.user_id
                )
            ).first()
            
            if existing_staff:
                # Promote to MANAGER if not already
                if existing_staff.role != VenueRole.MANAGER:
                    existing_staff.role = VenueRole.MANAGER
                    session.add(existing_staff)
            else:
                # Add as MANAGER
                # Note: We intentionally do NOT add the Admin (requester) to staff
                new_staff = VenueStaff(
                    venue_id=venue.id,
                    user_id=claim.user_id,
                    role=VenueRole.MANAGER
                )
                session.add(new_staff)
            
            # 4. Success Email
            if claim.user and claim.user.email:
                resend_email_service.send_venue_claim_approved(
                    to_email=claim.user.email, 
                    venue_name=venue.name, 
                    venue_id=venue.id,
                    username=claim.user.username
                )

    session.add(claim)
    session.commit()
    session.refresh(claim)
    
    # Send Notification (Reject only)
    # We handled Approval email specifically above with the new template
    if action == "reject" and claim.user and claim.user.email:
        venue_name = claim.venue.name if claim.venue else "Unknown Venue"
        notification_service.notify_venue_claim_update(claim.user.email, venue_name, claim.status)

    return claim


# ============================================================
# VENUE INVITATIONS (GOLDEN KEY)
# ============================================================

class VenueInviteRequest(BaseModel):
    email: str

class VenueInviteResponse(BaseModel):
    id: int
    venue_id: str
    email: str
    token: str
    expires_at: datetime
    
    class Config:
        from_attributes = True

@router.post("/venues/{venue_id}/invite", response_model=VenueInviteResponse)
def create_venue_invite(
    venue_id: str,
    invite_data: VenueInviteRequest,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Create a venue ownership invitation (Golden Key).
    Generates a token and sends an email to the recipient.
    When they click the link, ownership is instantly transferred.
    """
    from app.core.utils import normalize_uuid
    
    venue = session.get(Venue, normalize_uuid(venue_id))
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    # Create invite
    invite = VenueInvite(
        venue_id=venue.id,
        email=invite_data.email
    )
    session.add(invite)
    session.commit()
    session.refresh(invite)
    
    # Send email
    invite_url = f"{settings.FRONTEND_URL.rstrip('/')}/accept-venue-invite/{invite.token}"
    resend_email_service.send_venue_invite(
        to_email=invite_data.email,
        venue_name=venue.name,
        invite_url=invite_url
    )
    
    return invite


@router.get("/venues/invites", response_model=List[VenueInviteResponse])
def list_venue_invites(
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """List all venue invites (for admin dashboard)."""
    invites = session.exec(
        select(VenueInvite).order_by(VenueInvite.created_at.desc())
    ).all()
    return invites


# ============================================================
# EVENT CLAIMS ADMIN
# ============================================================

class EventClaimAdminResponse(BaseModel):
    id: int
    event_id: str
    event_title: str
    user_id: str
    user_email: str
    status: str
    reason: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/event-claims", response_model=List[EventClaimAdminResponse])
def list_event_claims(
    status_filter: Optional[str] = Query(None, alias="status"),
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """List event ownership claims."""
    query = select(EventClaim)
    if status_filter:
        query = query.where(EventClaim.status == status_filter)
    query = query.order_by(EventClaim.created_at.desc())
    claims = session.exec(query).all()
    
    results = []
    for claim in claims:
        event = session.get(Event, claim.event_id)
        user = session.get(User, claim.user_id)
        results.append(EventClaimAdminResponse(
            id=claim.id,
            event_id=claim.event_id,
            event_title=event.title if event else "Deleted Event",
            user_id=claim.user_id,
            user_email=user.email if user else "Unknown",
            status=claim.status,
            reason=claim.reason,
            created_at=claim.created_at,
            updated_at=claim.updated_at
        ))
    return results


@router.post("/event-claims/{claim_id}/{action}", response_model=EventClaimAdminResponse)
def process_event_claim(
    claim_id: int,
    action: str,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Approve or reject an event claim."""
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid action")
    
    claim = session.get(EventClaim, claim_id)
    if not claim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    
    if claim.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Claim is not pending")
    
    claim.status = "approved" if action == "approve" else "rejected"
    claim.updated_at = datetime.utcnow()
    
    if action == "approve":
        event = session.get(Event, claim.event_id)
        if event:
            event.organizer_id = claim.user_id
            session.add(event)
    
    session.add(claim)
    session.commit()
    session.refresh(claim)
    
    # Send Notification
    if claim.user and claim.user.email:
        event = session.get(Event, claim.event_id)
        event_title = event.title if event else "Unknown Event"
        notification_service.notify_event_claim_update(claim.user.email, event_title, claim.status)
    
    # Get related data for response
    event = session.get(Event, claim.event_id)
    user = session.get(User, claim.user_id)
    
    return EventClaimAdminResponse(
        id=claim.id,
        event_id=claim.event_id,
        event_title=event.title if event else "Deleted Event",
        user_id=claim.user_id,
        user_email=user.email if user else "Unknown",
        status=claim.status,
        reason=claim.reason,
        created_at=claim.created_at,
        updated_at=claim.updated_at
    )


# ============================================================
# FEATURED BOOKINGS ADMIN
# ============================================================

@router.get("/featured")
def get_all_featured_bookings(
    status_filter: Optional[str] = Query(None, alias="status"),
    slot_type: Optional[str] = None,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Get all featured bookings with optional filters."""
    query = select(FeaturedBooking).order_by(FeaturedBooking.created_at.desc())

    if status_filter:
        query = query.where(FeaturedBooking.status == status_filter)
    if slot_type:
        query = query.where(FeaturedBooking.slot_type == slot_type)

    bookings = session.exec(query).all()

    results = []
    for booking in bookings:
        event = session.get(Event, booking.event_id)
        organizer = session.get(User, booking.organizer_id)
        results.append({
            "id": booking.id,
            "event_id": booking.event_id,
            "event_title": event.title if event else "Deleted Event",
            "organizer_id": booking.organizer_id,
            "organizer_email": organizer.email if organizer else None,
            "organizer_username": organizer.username if organizer else None,
            "is_trusted": organizer.is_trusted_organizer if organizer else False,
            "slot_type": booking.slot_type.value,
            "target_id": booking.target_id,
            "start_date": booking.start_date.isoformat(),
            "end_date": booking.end_date.isoformat(),
            "status": booking.status.value,
            "amount_paid": booking.amount_paid,
            "created_at": booking.created_at.isoformat()
        })

    return {"bookings": results}


@router.patch("/featured/{booking_id}/approve")
def approve_featured_booking(
    booking_id: str,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Approve a pending featured booking."""
    booking = session.get(FeaturedBooking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status != BookingStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail="Booking is not pending approval")

    booking.status = BookingStatus.ACTIVE
    booking.updated_at = datetime.utcnow()
    session.add(booking)

    # Update event featured status
    event = session.get(Event, booking.event_id)
    if event:
        event.featured = True
        event.featured_until = datetime.combine(booking.end_date, datetime.max.time())
        session.add(event)

    # Mark organizer as trusted for future bookings
    organizer = session.get(User, booking.organizer_id)
    if organizer and not organizer.is_trusted_organizer:
        organizer.is_trusted_organizer = True
        session.add(organizer)

    session.commit()

    # Send notification email
    if organizer:
        event = session.get(Event, booking.event_id)
        event_title = event.title if event else "your event"
        resend_email_service.send_organizer_alert(
            organizer.email,
            organizer.display_name or organizer.email,
            event_title,
            "approved",
            ""
        )

    return {"status": "approved", "booking_id": booking_id}


@router.patch("/featured/{booking_id}/reject")
def reject_featured_booking(
    booking_id: str,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Reject a pending featured booking and issue refund."""
    booking = session.get(FeaturedBooking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status != BookingStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail="Booking is not pending approval")

    # Issue refund via Stripe
    if booking.stripe_payment_intent_id and settings.STRIPE_SECRET_KEY:
        try:
            stripe.api_key = settings.STRIPE_SECRET_KEY
            stripe.Refund.create(payment_intent=booking.stripe_payment_intent_id)
        except stripe.error.StripeError as e:
            raise HTTPException(status_code=500, detail=f"Refund failed: {str(e)}")

    booking.status = BookingStatus.REJECTED
    booking.updated_at = datetime.utcnow()
    session.add(booking)
    session.commit()

    return {"status": "rejected", "booking_id": booking_id, "refunded": True}


@router.patch("/users/{user_id}/trust")
def toggle_trusted_organizer(
    user_id: str,
    trusted: bool,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Toggle trusted organizer status for a user."""
    normalized_id = user_id.replace("-", "") if "-" in user_id else user_id

    user = session.get(User, normalized_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_trusted_organizer = trusted
    session.add(user)
    session.commit()

    return {"user_id": user_id, "is_trusted_organizer": trusted}


@router.patch("/featured/{booking_id}/cancel")
def cancel_featured_booking(
    booking_id: str,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Cancel a pending payment booking (for abandoned checkouts)."""
    booking = session.get(FeaturedBooking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status not in [BookingStatus.PENDING_PAYMENT, BookingStatus.PENDING_APPROVAL]:
        raise HTTPException(status_code=400, detail="Can only cancel pending bookings")

    # If already paid (pending_approval), issue refund
    if booking.status == BookingStatus.PENDING_APPROVAL and booking.stripe_payment_intent_id:
        if settings.STRIPE_SECRET_KEY:
            try:
                stripe.api_key = settings.STRIPE_SECRET_KEY
                stripe.Refund.create(payment_intent=booking.stripe_payment_intent_id)
            except stripe.error.StripeError as e:
                raise HTTPException(status_code=500, detail=f"Refund failed: {str(e)}")

    booking.status = BookingStatus.CANCELLED
    booking.updated_at = datetime.utcnow()
    session.add(booking)
    session.commit()

    return {"status": "cancelled", "booking_id": booking_id}


@router.patch("/featured/{booking_id}/end")
def end_featured_booking(
    booking_id: str,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Manually end an active featured promotion early."""
    booking = session.get(FeaturedBooking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status != BookingStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Can only end active promotions")

    # Mark booking as completed
    booking.status = BookingStatus.COMPLETED
    booking.updated_at = datetime.utcnow()
    session.add(booking)

    # Check if event has any OTHER active bookings remaining
    from sqlmodel import and_
    other_active = session.exec(
        select(FeaturedBooking).where(
            and_(
                FeaturedBooking.event_id == booking.event_id,
                FeaturedBooking.status == BookingStatus.ACTIVE,
                FeaturedBooking.id != booking.id
            )
        )
    ).first()

    # Reset event featured status if no other active bookings
    event_updated = False
    if not other_active:
        event = session.get(Event, booking.event_id)
        if event:
            event.featured = False
            event.featured_until = None
            session.add(event)
            event_updated = True

    session.commit()

    return {
        "status": "ended",
        "booking_id": booking_id,
        "event_featured_reset": event_updated
    }



@router.api_route("/featured/sync", methods=["GET", "POST"])
def sync_featured_status(
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Sync event.featured status for all ACTIVE bookings.
    Use this to fix events that were featured before the featured flag update was implemented.
    """
    from sqlmodel import and_
    from datetime import date
    
    today = date.today()
    
    # Get all currently active bookings (within date range)
    active_bookings = session.exec(
        select(FeaturedBooking).where(
            and_(
                FeaturedBooking.status == BookingStatus.ACTIVE,
                FeaturedBooking.start_date <= today,
                FeaturedBooking.end_date >= today
            )
        )
    ).all()
    
    updated_events = []
    for booking in active_bookings:
        event = session.get(Event, booking.event_id)
        if event and not event.featured:
            event.featured = True
            event.featured_until = datetime.combine(booking.end_date, datetime.max.time())
            session.add(event)
            updated_events.append({
                "event_id": event.id,
                "event_title": event.title,
                "featured_until": str(event.featured_until)
            })
    
    session.commit()
    
    return {
        "synced": len(updated_events),
        "total_active_bookings": len(active_bookings),
        "events_updated": updated_events
    }

# ============================================================
# SLOT PRICING ADMIN
# ============================================================

@router.get("/pricing")
def get_all_pricing(
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Get all slot pricing configuration."""
    results = []
    for slot_type in SlotType:
        pricing = session.get(SlotPricing, slot_type.value)
        if pricing:
            results.append({
                "slot_type": pricing.slot_type,
                "price_per_day": pricing.price_per_day,
                "min_days": pricing.min_days,
                "max_concurrent": pricing.max_concurrent,
                "is_active": pricing.is_active,
                "description": pricing.description,
                "updated_at": pricing.updated_at.isoformat()
            })
        else:
            # Return defaults for slots not yet in database
            defaults = DEFAULT_PRICING.get(slot_type.value, {})
            results.append({
                "slot_type": slot_type.value,
                "price_per_day": defaults.get("price_per_day", 1000),
                "min_days": defaults.get("min_days", 3),
                "max_concurrent": defaults.get("max_concurrent", 3),
                "is_active": True,
                "description": defaults.get("description", ""),
                "updated_at": None
            })
    return {"pricing": results}


@router.patch("/pricing/{slot_type}")
def update_pricing(
    slot_type: str,
    price_per_day: Optional[int] = None,
    min_days: Optional[int] = None,
    max_concurrent: Optional[int] = None,
    is_active: Optional[bool] = None,
    description: Optional[str] = None,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Update pricing for a slot type."""
    # Validate slot type
    try:
        SlotType(slot_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid slot type")

    pricing = session.get(SlotPricing, slot_type)

    if not pricing:
        # Create new pricing record from defaults
        defaults = DEFAULT_PRICING.get(slot_type, {})
        pricing = SlotPricing(
            slot_type=slot_type,
            price_per_day=defaults.get("price_per_day", 1000),
            min_days=defaults.get("min_days", 3),
            max_concurrent=defaults.get("max_concurrent", 3),
            description=defaults.get("description", "")
        )

    # Apply updates
    if price_per_day is not None:
        pricing.price_per_day = price_per_day
    if min_days is not None:
        pricing.min_days = min_days
    if max_concurrent is not None:
        pricing.max_concurrent = max_concurrent
    if is_active is not None:
        pricing.is_active = is_active
    if description is not None:
        pricing.description = description

    pricing.updated_at = datetime.utcnow()
    session.add(pricing)
    session.commit()

    return {
        "slot_type": pricing.slot_type,
        "price_per_day": pricing.price_per_day,
        "min_days": pricing.min_days,
        "max_concurrent": pricing.max_concurrent,
        "is_active": pricing.is_active,
        "description": pricing.description
    }


# NOTE: Migration endpoints removed for security.
# Database migrations should be run via CLI scripts in backend/scripts/
# See: scripts/migrate_collections.py
    
    return {
        "id": invite.id,
        "venue_id": invite.venue_id,
        "token": invite.token,
        "email": invite.email,
        "status": status,
        "user_email": invite.user_email,
        "created_at": invite.created_at,
        "expires_at": invite.expires_at,
        "claimed": invite.claimed
    }


# ============================================================
# UNVERIFIED VENUES (RISING LOCATIONS)
# ============================================================

class UnverifiedVenueStats(BaseModel):
    id: str
    name: str
    address: str
    created_at: datetime
    event_count: int

@router.get("/venues/unverified", response_model=List[UnverifiedVenueStats])
def get_unverified_venues(
    limit: int = 10,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Get top unverified venues sorted by number of events.
    Used for 'Rising Locations' widget.
    """
    # Group by Venue and count events
    # We want venues with status=UNVERIFIED
    # Sorted by event count DESC
    
    # Note: VenueStatus.UNVERIFIED might need string cast if Enum issues arise, 
    # but SQLModel usually handles it.
    
    query = (
        select(Venue, func.count(Event.id).label("event_count"))
        .outerjoin(Event, Event.venue_id == Venue.id)
        .where(Venue.status == VenueStatus.UNVERIFIED)
        .group_by(Venue.id)
        .order_by(func.count(Event.id).desc())
        .limit(limit)
    )
    
    results = session.exec(query).all()
    
    response = []
    for venue, count in results:
        response.append(UnverifiedVenueStats(
            id=venue.id,
            name=venue.name,
            address=venue.address,
            created_at=venue.created_at,
            event_count=count
        ))
        
    return response
