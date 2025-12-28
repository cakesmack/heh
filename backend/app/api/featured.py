"""
Featured Booking API routes.
Handles availability checks, checkout, and booking management.
"""
from datetime import date, datetime
from typing import List, Optional
import traceback
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header, Query
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
    print("[STRIPE WEBHOOK] Received webhook request")
    
    if not settings.STRIPE_WEBHOOK_SECRET:
        print("[STRIPE WEBHOOK ERROR] Webhook secret not configured")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    payload = await request.body()
    print(f"[STRIPE WEBHOOK] Payload size: {len(payload)} bytes")

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
        print(f"[STRIPE WEBHOOK] Event type: {event['type']}")
    except ValueError as e:
        print(f"[STRIPE WEBHOOK ERROR] Invalid payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        print(f"[STRIPE WEBHOOK ERROR] Invalid signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle events with safety net error handling
    try:
        if event["type"] == "checkout.session.completed":
            print(f"[STRIPE WEBHOOK] Processing checkout.session.completed")
            session_data = event["data"]["object"]
            booking_id = session_data.get("metadata", {}).get("booking_id")
            print(f"[STRIPE WEBHOOK] Booking ID from metadata: {booking_id}")
            handle_checkout_completed(session, session_data)
            print(f"[STRIPE WEBHOOK] Successfully processed checkout completion for booking: {booking_id}")
        elif event["type"] == "checkout.session.expired":
            print(f"[STRIPE WEBHOOK] Processing checkout.session.expired")
            handle_checkout_expired(session, event["data"]["object"])
            print(f"[STRIPE WEBHOOK] Successfully processed checkout expiration")
    except Exception as e:
        print(f"[STRIPE WEBHOOK CRITICAL ERROR] Exception during event handling: {e}")
        traceback.print_exc()
        # Still return 200 to Stripe to prevent retries, but log the error
        return {"status": "error", "message": str(e)}

    return {"status": "ok"}


# ============================================================
# VERIFY SESSION ENDPOINT (Fallback for webhook delays/failures)
# ============================================================

class VerifySessionResponse(BaseModel):
    success: bool
    booking_id: Optional[str] = None
    status: Optional[str] = None
    message: str


@router.get("/verify-session", response_model=VerifySessionResponse)
def verify_stripe_session(
    session_id: str = Query(None, description="Stripe checkout session ID"),
    booking_id: str = Query(None, description="Featured booking ID"),
    session: Session = Depends(get_session)
):
    """
    Verify and finalize a Stripe checkout session.
    
    This endpoint serves as a fallback when webhooks are delayed or fail.
    The frontend should call this after Stripe redirects back.
    """
    print(f"[VERIFY SESSION] Called with session_id={session_id}, booking_id={booking_id}")
    
    try:
        # Approach 1: If we have the booking_id, check its current status
        if booking_id:
            booking = session.get(FeaturedBooking, booking_id)
            if not booking:
                print(f"[VERIFY SESSION] Booking not found: {booking_id}")
                return VerifySessionResponse(
                    success=False,
                    message="Booking not found"
                )
            
            # If already active or pending approval, return success
            if booking.status in [BookingStatus.ACTIVE, BookingStatus.PENDING_APPROVAL]:
                print(f"[VERIFY SESSION] Booking already processed: {booking.status}")
                return VerifySessionResponse(
                    success=True,
                    booking_id=booking.id,
                    status=booking.status.value,
                    message="Payment verified successfully"
                )
            
            # If still pending payment, try to verify with Stripe
            if booking.status == BookingStatus.PENDING_PAYMENT and booking.stripe_checkout_session_id:
                session_id = booking.stripe_checkout_session_id
        
        # Approach 2: Verify directly with Stripe using session_id
        if not session_id:
            print("[VERIFY SESSION] No session_id provided and booking has no stripe session")
            return VerifySessionResponse(
                success=False,
                message="No session ID available for verification"
            )
        
        # Check Stripe API key
        if not settings.STRIPE_SECRET_KEY:
            print("[VERIFY SESSION ERROR] Stripe API key not configured")
            return VerifySessionResponse(
                success=False,
                message="Payment system not configured"
            )
        
        # Retrieve the session from Stripe
        print(f"[VERIFY SESSION] Retrieving Stripe session: {session_id}")
        try:
            stripe_session = stripe.checkout.Session.retrieve(session_id)
        except stripe.error.InvalidRequestError as e:
            print(f"[VERIFY SESSION ERROR] Invalid Stripe session: {e}")
            return VerifySessionResponse(
                success=False,
                message="Invalid payment session"
            )
        except stripe.error.AuthenticationError as e:
            print(f"[VERIFY SESSION ERROR] Stripe auth failed: {e}")
            return VerifySessionResponse(
                success=False,
                message="Payment system authentication error"
            )
        
        print(f"[VERIFY SESSION] Stripe session status: {stripe_session.payment_status}")
        
        # Check if payment was successful
        if stripe_session.payment_status != "paid":
            return VerifySessionResponse(
                success=False,
                message=f"Payment not completed. Status: {stripe_session.payment_status}"
            )
        
        # Get booking from metadata
        metadata_booking_id = stripe_session.metadata.get("booking_id")
        if not metadata_booking_id:
            print("[VERIFY SESSION ERROR] No booking_id in Stripe metadata")
            return VerifySessionResponse(
                success=False,
                message="Payment session missing booking reference"
            )
        
        # Find and update the booking
        booking = session.get(FeaturedBooking, metadata_booking_id)
        if not booking:
            print(f"[VERIFY SESSION ERROR] Booking not found: {metadata_booking_id}")
            return VerifySessionResponse(
                success=False,
                message="Booking record not found"
            )
        
        # Update if still pending payment
        if booking.status == BookingStatus.PENDING_PAYMENT:
            print(f"[VERIFY SESSION] Updating booking {booking.id} status")
            
            # Get payment intent ID
            booking.stripe_payment_intent_id = stripe_session.payment_intent
            
            # Check if organizer is trusted
            organizer = session.get(User, booking.organizer_id)
            if organizer and organizer.is_trusted_organizer:
                booking.status = BookingStatus.ACTIVE
                print(f"[VERIFY SESSION] Set to ACTIVE (trusted organizer)")
            else:
                booking.status = BookingStatus.PENDING_APPROVAL
                print(f"[VERIFY SESSION] Set to PENDING_APPROVAL")
            
            booking.updated_at = datetime.utcnow()
            session.add(booking)
            session.commit()
            session.refresh(booking)
        
        return VerifySessionResponse(
            success=True,
            booking_id=booking.id,
            status=booking.status.value,
            message="Payment verified and booking updated successfully"
        )
        
    except Exception as e:
        print(f"[VERIFY SESSION CRITICAL ERROR] {e}")
        traceback.print_exc()
        return VerifySessionResponse(
            success=False,
            message=f"Verification failed: {str(e)}"
        )
