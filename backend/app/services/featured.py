"""
Featured booking service.
Handles availability checks, pricing, and Stripe checkout creation.
"""
from datetime import date, datetime, timedelta
from typing import Optional
import stripe
from sqlmodel import Session, select, and_

from app.core.config import settings
from app.models.featured_booking import (
    FeaturedBooking, SlotType, BookingStatus, SLOT_CONFIG
)
from app.models.slot_pricing import SlotPricing, DEFAULT_PRICING
from app.models.event import Event
from app.models.user import User
from app.services.resend_email import resend_email_service

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


def get_slot_pricing(session: Session, slot_type: SlotType) -> dict:
    """
    Get pricing config for a slot type from database.
    Falls back to SLOT_CONFIG if not in database.
    """
    pricing = session.get(SlotPricing, slot_type.value)

    if pricing and pricing.is_active:
        return {
            "max": pricing.max_concurrent,
            "price_per_day": pricing.price_per_day,
            "min_days": pricing.min_days
        }

    # Fallback to hardcoded config
    return SLOT_CONFIG.get(slot_type, {
        "max": 3,
        "price_per_day": 1000,
        "min_days": 3
    })



def check_availability(
    session: Session,
    slot_type: SlotType,
    start_date: date,
    end_date: date,
    target_id: Optional[str] = None
) -> dict:
    """
    Check slot availability for a date range.
    STRICT MODE: Filters strictly by slot_type.
    """
    # Coerce to PREMIUM for unified consolidation
    slot_type = SlotType.PREMIUM

    # STRICT ENFORCEMENT: Block legacy types for new checks
    if slot_type in [SlotType.HERO_HOME, SlotType.GLOBAL_PINNED]:
        return {
            "available": False,
            "error": f"Slot type {slot_type.value} is no longer available",
            "unavailable_dates": [],
            "slots_remaining": {},
            "price_quote": 0,
            "num_days": (end_date - start_date).days + 1
        }
    config = get_slot_pricing(session, slot_type)
    max_slots = config["max"]
    price_per_day = config["price_per_day"]
    min_days = config["min_days"]

    # Calculate number of days
    num_days = (end_date - start_date).days + 1
    if num_days < min_days:
        return {
            "available": False,
            "error": f"Minimum booking is {min_days} days",
            "unavailable_dates": [],
            "slots_remaining": {},
            "price_quote": 0,
            "num_days": num_days
        }

    # Query existing bookings that overlap
    blocking_statuses = [
        BookingStatus.PENDING_PAYMENT,
        BookingStatus.ACTIVE
    ]

    # STRICT FILTER: Only count bookings for THIS EXACT slot_type
    print(f"[DEBUG CHECK_AVAILABILITY] Checking for slot_type: {slot_type}")
    query = select(FeaturedBooking).where(
        and_(
            FeaturedBooking.slot_type == slot_type,
            FeaturedBooking.status.in_(blocking_statuses),
            FeaturedBooking.start_date <= end_date,
            FeaturedBooking.end_date >= start_date
        )
    )

    if target_id:
        query = query.where(FeaturedBooking.target_id == target_id)
    elif slot_type == SlotType.CATEGORY_PINNED:
        # For category pinned without target_id, return error
        return {
            "available": False,
            "error": "target_id required for CATEGORY_PINNED",
            "unavailable_dates": [],
            "slots_remaining": {},
            "price_quote": 0,
            "num_days": num_days
        }

    existing_bookings = session.exec(query).all()
    print(f"[DEBUG CHECK_AVAILABILITY] Found {len(existing_bookings)} existing bookings for {slot_type}")
    for b in existing_bookings:
        print(f"  - Booking {b.id}: slot={b.slot_type}, status={b.status}, dates={b.start_date} to {b.end_date}")

    # Check each date in range
    unavailable_dates = []
    slots_remaining = {}
    current = start_date

    while current <= end_date:
        # Count bookings active on this date for this specific slot_type
        count = sum(
            1 for b in existing_bookings
            if b.start_date <= current <= b.end_date
        )
        remaining = max_slots - count
        slots_remaining[current.isoformat()] = remaining

        if remaining <= 0:
            unavailable_dates.append(current.isoformat())

        current += timedelta(days=1)

    available = len(unavailable_dates) == 0
    price_quote = num_days * price_per_day if available else 0

    return {
        "available": available,
        "unavailable_dates": unavailable_dates,
        "slots_remaining": slots_remaining,
        "price_quote": price_quote,
        "num_days": num_days
    }


def get_active_featured(
    session: Session,
    slot_type: SlotType,
    target_id: Optional[str] = None
) -> list[FeaturedBooking]:
    """
    Get currently active featured bookings for display.
    STRICT FILTERING: Only returns bookings for the requested slot_type.
    """
    today = date.today()
    
    # Safety: If no slot_type provided, return empty to prevent leaks
    if not slot_type:
        return []

    # Strict query for ACTIVE bookings
    query = select(FeaturedBooking).where(
        and_(
            FeaturedBooking.status == BookingStatus.ACTIVE,
            FeaturedBooking.start_date <= today,
            FeaturedBooking.end_date >= today,
            FeaturedBooking.slot_type == slot_type  # CRITICAL: Strict equality
        )
    )

    if target_id:
        query = query.where(FeaturedBooking.target_id == target_id)

    return list(session.exec(query).all())


def create_checkout_session(
    session: Session,
    user: User,
    event: Event,
    slot_type: SlotType,
    start_date: date,
    end_date: date,
    target_id: Optional[str] = None,
    custom_subtitle: Optional[str] = None
) -> dict:
    """
    Create a Stripe Checkout session and FeaturedBooking.
    """
    # Coerce to PREMIUM for unified consolidation
    slot_type = SlotType.PREMIUM

    # TRANSACTIONAL LOCK: Lock the pricing record to prevent concurrent availability races
    session.exec(
        select(SlotPricing).where(SlotPricing.slot_type == slot_type.value).with_for_update()
    )

    # STRICT ENFORCEMENT: Block legacy types for new checkouts
    if slot_type in [SlotType.HERO_HOME, SlotType.GLOBAL_PINNED]:
        raise ValueError(f"Slot type {slot_type.value} is no longer available for purchase")

    # Check availability first
    availability = check_availability(session, slot_type, start_date, end_date, target_id)
    if not availability["available"]:
        raise ValueError(availability.get("error", "Dates not available"))

    amount = availability["price_quote"]
    num_days = availability["num_days"]

    # Create booking with PENDING_PAYMENT status
    booking = FeaturedBooking(
        event_id=event.id,
        organizer_id=user.id,
        slot_type=slot_type,
        target_id=target_id,
        start_date=start_date,
        end_date=end_date,
        status=BookingStatus.PENDING_PAYMENT,
        amount_paid=amount,
        custom_subtitle=custom_subtitle
    )
    session.add(booking)
    session.commit()
    session.refresh(booking)

    # Create Stripe Checkout Session
    slot_name = slot_type.value.replace("_", " ").title()

    # Format event ID with dashes for URL (UUID format)
    eid = event.id
    formatted_event_id = f"{eid[:8]}-{eid[8:12]}-{eid[12:16]}-{eid[16:20]}-{eid[20:]}" if len(eid) == 32 else eid

    # Check if we are running locally or in production
    if settings.DEBUG:
        base_url = "http://localhost:3000"
    else:
        base_url = settings.FRONTEND_URL

    checkout_session = stripe.checkout.Session.create(
        customer_email=user.email,
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "gbp",
                "product_data": {
                    "name": f"Featured: {slot_name}",
                    "description": f"{event.title} - {num_days} days ({start_date} to {end_date})"
                },
                "unit_amount": amount,
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=f"{base_url}/featured/success?session_id={{CHECKOUT_SESSION_ID}}&booking_id={booking.id}",
        cancel_url=f"{base_url}/events/{formatted_event_id}/promote?cancelled=true",
        metadata={
            "booking_id": booking.id,
            "event_id": event.id,
            "organizer_id": user.id,
        },
        expires_at=int((datetime.utcnow() + timedelta(minutes=30)).timestamp()),
    )

    # Update booking with Stripe session ID
    booking.stripe_checkout_session_id = checkout_session.id
    session.add(booking)
    # commit() is handled by the caller or we can do it here if within its own transaction
    session.commit()

    return {
        "checkout_url": checkout_session.url,
        "booking_id": booking.id
    }


def activate_booking(
    session: Session, 
    booking: FeaturedBooking, 
    payment_intent_id: Optional[str] = None,
    invoice_url: Optional[str] = None
) -> None:
    """
    Standardized activation logic for featured bookings.
    Used by both the Webhook and the Verify-Session fallback.
    """
    if booking.status == BookingStatus.ACTIVE:
        return

    # 1. Update booking status
    booking.status = BookingStatus.ACTIVE
    if payment_intent_id:
        booking.stripe_payment_intent_id = payment_intent_id
    booking.updated_at = datetime.utcnow()
    session.add(booking)

    # 2. Sync event.featured flag (Phase 2 Directive)
    event = session.get(Event, booking.event_id)
    if event:
        event.featured = True
        # Set featured_until to the end of the booking day
        event.featured_until = datetime.combine(booking.end_date, datetime.max.time())
        session.add(event)
    
    session.commit()
    print(f"[FEATURED SERVICE] Activated booking {booking.id} for event {booking.event_id}")

    # 3. Send success email notification (Phase 6 Restoration)
    # We do this in a try/except to ensure activation doesn't fail if email fails
    try:
        user = session.get(User, booking.organizer_id)
        if user and user.email:
            print(f"[FEATURED SERVICE] Sending success notification to {user.email}")
            import asyncio
            
            # Using asyncio.create_task or similar would require a running loop
            # and may be tricky in sync context. We'll just await it for now 
            # as our services are generally async-compatible or we can use a helper.
            # Since activate_booking is sync, we need a way to run it.
            # However, handle_checkout_completed is sync, but verify_stripe_session is sync too.
            # Wait, verify_stripe_session is sync (no async def).
            # But resend_email_service.send_featured_notification IS async.
            
            # We need to bridge sync to async.
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(resend_email_service.send_featured_notification(
                        to_email=user.email,
                        event_title=event.title if event else "Your Event",
                        username=user.username,
                        invoice_url=invoice_url
                    ))
                else:
                    loop.run_until_complete(resend_email_service.send_featured_notification(
                        to_email=user.email,
                        event_title=event.title if event else "Your Event",
                        username=user.username,
                        invoice_url=invoice_url
                    ))
            except RuntimeError:
                # No event loop
                asyncio.run(resend_email_service.send_featured_notification(
                    to_email=user.email,
                    event_title=event.title if event else "Your Event",
                    username=user.username,
                    invoice_url=invoice_url
                ))
    except Exception as e:
        print(f"[FEATURED SERVICE ERROR] Failed to send notification: {e}")


def handle_checkout_completed(session: Session, stripe_session: dict) -> None:
    """
    Handle successful Stripe checkout.
    Uses centralized activate_booking logic.
    """
    booking_id = getattr(stripe_session.metadata, "booking_id", None) if getattr(stripe_session, "metadata", None) else None
    if not booking_id:
        return

    booking = session.get(FeaturedBooking, booking_id)
    if not booking:
        return
    
    payment_intent_id = getattr(stripe_session, "payment_intent", None)
    
    # Retrieve invoice URL if available
    invoice_url = None
    invoice_id = getattr(stripe_session, "invoice", None)
    if invoice_id:
        try:
            invoice = stripe.Invoice.retrieve(invoice_id)
            invoice_url = getattr(invoice, "hosted_invoice_url", None)
        except Exception as e:
            print(f"[FEATURED SERVICE ERROR] Failed to retrieve invoice {invoice_id}: {e}")

    activate_booking(session, booking, payment_intent_id, invoice_url)


def handle_checkout_expired(session: Session, stripe_session: dict) -> None:
    """
    Handle expired Stripe checkout.
    Cancels the booking to release the slot.
    """
    booking_id = getattr(stripe_session.metadata, "booking_id", None) if getattr(stripe_session, "metadata", None) else None
    if not booking_id:
        return

    booking = session.get(FeaturedBooking, booking_id)
    if not booking:
        return

    if booking.status == BookingStatus.PENDING_PAYMENT:
        booking.status = BookingStatus.CANCELLED
        booking.updated_at = datetime.utcnow()
        session.add(booking)
        session.commit()



