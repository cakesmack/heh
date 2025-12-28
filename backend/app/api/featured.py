"""
Featured Booking API routes.
Handles availability checks, checkout, and booking management.
"""
from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlmodel import Session, select
from pydantic import BaseModel
import stripe

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.event import Event
from app.models.featured_booking import FeaturedBooking, SlotType, BookingStatus, SLOT_CONFIG
from app.models.slot_pricing import SlotPricing, DEFAULT_PRICING
from app.services.featured import (
    check_availability,
    create_checkout_session,
    handle_checkout_completed,
    handle_checkout_expired,
    get_active_featured,
    get_slot_pricing
)

router = APIRouter(tags=["Featured"])

stripe.api_key = settings.STRIPE_SECRET_KEY


# ============================================================
# REQUEST/RESPONSE SCHEMAS
# ============================================================

class AvailabilityRequest(BaseModel):
    slot_type: SlotType
    start_date: date
    end_date: date
    target_id: Optional[str] = None


class AvailabilityResponse(BaseModel):
    available: bool
    unavailable_dates: List[str]
    slots_remaining: dict
    price_quote: int
    num_days: int
    error: Optional[str] = None


class CheckoutRequest(BaseModel):
    event_id: str
    slot_type: SlotType
    start_date: date
    end_date: date
    target_id: Optional[str] = None


class CheckoutResponse(BaseModel):
    checkout_url: str
    booking_id: str


class BookingResponse(BaseModel):
    id: str
    event_id: str
    event_title: Optional[str] = None
    slot_type: SlotType
    target_id: Optional[str] = None
    start_date: date
    end_date: date
    status: BookingStatus
    amount_paid: int
    created_at: datetime


class ActiveFeaturedResponse(BaseModel):
    id: str
    event_id: str
    event_title: str
    event_image_url: Optional[str] = None
    slot_type: SlotType
    start_date: date
    end_date: date


class SlotConfigResponse(BaseModel):
    slot_type: str
    max_slots: int
    price_per_day: int
    min_days: int


# ============================================================
# PUBLIC ENDPOINTS
# ============================================================

@router.get("/config", response_model=List[SlotConfigResponse])
def get_slot_config(session: Session = Depends(get_session)):
    """Get pricing and limits for all slot types."""
    results = []
    for slot_type in SlotType:
        config = get_slot_pricing(session, slot_type)
        results.append(SlotConfigResponse(
            slot_type=slot_type.value,
            max_slots=config["max"],
            price_per_day=config["price_per_day"],
            min_days=config["min_days"]
        ))
    return results


@router.post("/check-availability", response_model=AvailabilityResponse)
def check_slot_availability(
    request: AvailabilityRequest,
    session: Session = Depends(get_session)
):
    """Check if dates are available for a slot type."""
    result = check_availability(
        session,
        request.slot_type,
        request.start_date,
        request.end_date,
        request.target_id
    )
    return AvailabilityResponse(**result)


@router.get("/active", response_model=List[ActiveFeaturedResponse])
def get_active_slots(
    slot_type: SlotType,
    target_id: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """Get currently active featured events for display."""
    bookings = get_active_featured(session, slot_type, target_id)

    results = []
    for booking in bookings:
        event = session.get(Event, booking.event_id)
        if event:
            results.append(ActiveFeaturedResponse(
                id=booking.id,
                event_id=booking.event_id,
                event_title=event.title,
                event_image_url=event.image_url,
                slot_type=booking.slot_type,
                start_date=booking.start_date,
                end_date=booking.end_date
            ))

    return results


# ============================================================
# AUTHENTICATED ENDPOINTS
# ============================================================

@router.post("/create-checkout", response_model=CheckoutResponse)
def create_featured_checkout(
    request: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Create Stripe checkout session for featured booking."""
    # Normalize event ID (remove dashes if present)
    event_id = request.event_id.replace("-", "") if "-" in request.event_id else request.event_id

    # Verify event exists and user owns it
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not your event")

    try:
        result = create_checkout_session(
            session,
            current_user,
            event,
            request.slot_type,
            request.start_date,
            request.end_date,
            request.target_id
        )
        return CheckoutResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my-bookings", response_model=List[BookingResponse])
def get_my_bookings(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get current user's featured bookings."""
    bookings = session.exec(
        select(FeaturedBooking)
        .where(FeaturedBooking.organizer_id == current_user.id)
        .order_by(FeaturedBooking.created_at.desc())
    ).all()

    results = []
    for booking in bookings:
        event = session.get(Event, booking.event_id)
        results.append(BookingResponse(
            id=booking.id,
            event_id=booking.event_id,
            event_title=event.title if event else None,
            slot_type=booking.slot_type,
            target_id=booking.target_id,
            start_date=booking.start_date,
            end_date=booking.end_date,
            status=booking.status,
            amount_paid=booking.amount_paid,
            created_at=booking.created_at
        ))

    return results


# ============================================================
# WEBHOOK ENDPOINT
# ============================================================

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    session: Session = Depends(get_session)
):
    """Handle Stripe webhook events."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle events
    if event["type"] == "checkout.session.completed":
        handle_checkout_completed(session, event["data"]["object"])
    elif event["type"] == "checkout.session.expired":
        handle_checkout_expired(session, event["data"]["object"])

    return {"status": "ok"}
