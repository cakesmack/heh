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

    Returns:
        {
            "available": bool,
            "unavailable_dates": [date, ...],
            "slots_remaining": {date_str: int, ...},
            "price_quote": int (pence),
            "num_days": int
        }
    """
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
        BookingStatus.PENDING_APPROVAL,
        BookingStatus.ACTIVE
    ]

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

    # Check each date in range
    unavailable_dates = []
    slots_remaining = {}
    current = start_date

    while current <= end_date:
        # Count bookings active on this date
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

    Returns:
        {"checkout_url": str, "booking_id": str}
    """
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
        custom_subtitle=custom_subtitle  # Save custom subtitle for hero carousel
    )
    session.add(booking)
    session.commit()
    session.refresh(booking)

    # Create Stripe Checkout Session
    slot_name = slot_type.value.replace("_", " ").title()

    # Format event ID with dashes for URL (UUID format)
    eid = event.id
    formatted_event_id = f"{eid[:8]}-{eid[8:12]}-{eid[12:16]}-{eid[16:20]}-{eid[20:]}" if len(eid) == 32 else eid

    checkout_session = stripe.checkout.Session.create(
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
        success_url=f"{settings.FRONTEND_URL}/account?featured=success&booking_id={booking.id}",
        cancel_url=f"{settings.FRONTEND_URL}/events/{formatted_event_id}/promote?cancelled=true",
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
    session.commit()

    return {
        "checkout_url": checkout_session.url,
        "booking_id": booking.id
    }


def handle_checkout_completed(session: Session, stripe_session: dict) -> None:
    """
    Handle successful Stripe checkout.
    PAID bookings are ACTIVE immediately - no approval gate.
    For HERO_HOME bookings, auto-assign to an empty HeroSlot.
    """
    from app.models.hero import HeroSlot  # Import here to avoid circular
    
    print(f"[CHECKOUT COMPLETED] Starting processing")
    
    booking_id = stripe_session.get("metadata", {}).get("booking_id")
    print(f"[CHECKOUT COMPLETED] Booking ID: {booking_id}")
    
    if not booking_id:
        print("[CHECKOUT COMPLETED] No booking_id in metadata, returning early")
        return

    booking = session.get(FeaturedBooking, booking_id)
    if not booking:
        print(f"[CHECKOUT COMPLETED] Booking not found: {booking_id}")
        return
    
    print(f"[CHECKOUT COMPLETED] Found booking, slot_type: {booking.slot_type}, current status: {booking.status}")

    # Get payment intent ID
    booking.stripe_payment_intent_id = stripe_session.get("payment_intent")
    print(f"[CHECKOUT COMPLETED] Payment intent: {booking.stripe_payment_intent_id}")

    # CHANGE 1: Paid bookings are ACTIVE immediately - no trusted organizer gate
    booking.status = BookingStatus.ACTIVE
    print(f"[CHECKOUT COMPLETED] Setting status to ACTIVE (paid = instant approval)")
    
    # Update event featured status
    event = session.get(Event, booking.event_id)
    if event:
        event.featured = True
        event.featured_until = datetime.combine(booking.end_date, datetime.max.time())
        session.add(event)
        print(f"[CHECKOUT COMPLETED] Set event.featured = True, until {event.featured_until}")
    
        if assign_hero_slot(session, booking.event_id):
            print(f"[CHECKOUT COMPLETED] Successfully assigned event to Hero Slot")
        else:
            print(f"[CHECKOUT COMPLETED] All HeroSlots full - event will display via FeaturedBooking API only")

    booking.updated_at = datetime.utcnow()
    session.add(booking)
    print(f"[CHECKOUT COMPLETED] Calling session.commit()")
    session.commit()
    print(f"[CHECKOUT COMPLETED] Committed successfully, final status: {booking.status}")


def assign_hero_slot(session: Session, event_id: str) -> bool:
    """
    Finds the first available Hero Slot (position > 1) and assigns the event to it.
    Forces the slot to be active.
    Returns True if assigned, False if no slots available.
    """
    from app.models.hero import HeroSlot
    
    # 1. Find the first empty slot (Skipping Slot 1 which is the Welcome Slide)
    # We look for ANY slot > 1 that has no event_id, regardless of 'is_active' status.
    target_slot = session.exec(
        select(HeroSlot)
        .where(HeroSlot.position > 1)
        .where(HeroSlot.event_id == None)
        .order_by(HeroSlot.position)
    ).first()
    
    if target_slot:
        print(f"[HERO ASSIGNMENT] ✅ Found Empty Slot: {target_slot.position}. Assigning event...")
        target_slot.event_id = event_id
        target_slot.is_active = True  # Force it to wake up
        target_slot.type = "spotlight_event" # Ensure type is correct
        session.add(target_slot)
        return True
    
    print("[HERO ASSIGNMENT] ⚠️ WARNING: All Hero Slots (2-5) are full!")
    return False


def handle_checkout_expired(session: Session, stripe_session: dict) -> None:
    """
    Handle expired Stripe checkout.
    Cancels the booking to release the slot.
    """
    booking_id = stripe_session.get("metadata", {}).get("booking_id")
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


def get_active_featured(
    session: Session,
    slot_type: SlotType,
    target_id: Optional[str] = None
) -> list[FeaturedBooking]:
    """
    Get currently active featured bookings for display.
    """
    today = date.today()

    query = select(FeaturedBooking).where(
        and_(
            FeaturedBooking.slot_type == slot_type,
            FeaturedBooking.status == BookingStatus.ACTIVE,
            FeaturedBooking.start_date <= today,
            FeaturedBooking.end_date >= today
        )
    )

    if target_id:
        query = query.where(FeaturedBooking.target_id == target_id)

    return list(session.exec(query).all())
