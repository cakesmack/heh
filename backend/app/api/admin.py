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
    has_password: bool  # True = Email login, False = Google login
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
            has_password=user.password_hash is not None,
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
        has_password=user.password_hash is not None,
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
        has_password=user.password_hash is not None,
        created_at=user.created_at,
        event_count=event_count,
        checkin_count=checkin_count,
    )


class AdminUserUpdate(BaseModel):
    """Schema for updating user fields."""
    email: Optional[str] = None
    username: Optional[str] = None
    display_name: Optional[str] = None
    is_admin: Optional[bool] = None


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
        created_at=user.created_at,
        event_count=event_count,
        checkin_count=checkin_count,
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
