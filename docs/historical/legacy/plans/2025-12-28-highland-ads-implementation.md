# Highland Ads Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an inventory-based advertising system with Stripe payments for featured event placements.

**Architecture:** FeaturedBooking model tracks slot reservations with date ranges. Stripe Checkout handles payments, webhooks update status. Frontend shows "Promote" UI for organizers, admin dashboard for approval. Hero carousel prioritizes paid slots over manual.

**Tech Stack:** FastAPI, SQLModel, Stripe API, Next.js/React, TailwindCSS

---

## Task 1: Add Stripe Package

**Files:**
- Modify: `backend/requirements.txt`

**Step 1: Add stripe to requirements**

Add to `backend/requirements.txt`:
```
stripe>=7.0.0
```

**Step 2: Install**

```bash
cd backend && pip install stripe
```

**Step 3: Verify**

```bash
python -c "import stripe; print('Stripe OK')"
```

**Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "feat: add Stripe package"
```

---

## Task 2: Create FeaturedBooking Model

**Files:**
- Create: `backend/app/models/featured_booking.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/models/user.py`

**Step 1: Create the model**

Create `backend/app/models/featured_booking.py`:

```python
"""
FeaturedBooking model for paid advertising slots.
Tracks slot reservations with date ranges and payment status.
"""
from datetime import datetime, date
from enum import Enum
from typing import Optional, TYPE_CHECKING
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .event import Event
    from .user import User


class SlotType(str, Enum):
    """Types of featured placements available."""
    HERO_HOME = "hero_home"
    GLOBAL_PINNED = "global_pinned"
    CATEGORY_PINNED = "category_pinned"
    NEWSLETTER = "newsletter"


class BookingStatus(str, Enum):
    """Status workflow for featured bookings."""
    PENDING_PAYMENT = "pending_payment"
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


# Slot limits and pricing (pence)
SLOT_CONFIG = {
    SlotType.HERO_HOME: {"max": 5, "price_per_day": 4000, "min_days": 3},
    SlotType.GLOBAL_PINNED: {"max": 3, "price_per_day": 2000, "min_days": 3},
    SlotType.CATEGORY_PINNED: {"max": 3, "price_per_day": 1000, "min_days": 3},
    SlotType.NEWSLETTER: {"max": 2, "price_per_day": 1500, "min_days": 1},
}


class FeaturedBooking(SQLModel, table=True):
    """
    Represents a paid featured placement booking.

    Attributes:
        slot_type: Type of placement (hero, pinned, etc.)
        target_id: Category ID for CATEGORY_PINNED slots
        start_date/end_date: Date range for the booking
        status: Current status in the workflow
        amount_paid: Total paid in pence
    """
    __tablename__ = "featured_bookings"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    event_id: str = Field(foreign_key="events.id", index=True)
    organizer_id: str = Field(foreign_key="users.id", index=True)

    slot_type: SlotType = Field(index=True)
    target_id: Optional[str] = Field(default=None, index=True)  # Category ID for CATEGORY_PINNED

    start_date: date = Field(index=True)
    end_date: date = Field(index=True)

    status: BookingStatus = Field(default=BookingStatus.PENDING_PAYMENT, index=True)
    amount_paid: int = Field(default=0)  # In pence

    stripe_checkout_session_id: Optional[str] = Field(default=None, max_length=255)
    stripe_payment_intent_id: Optional[str] = Field(default=None, max_length=255)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    event: "Event" = Relationship()
    organizer: "User" = Relationship(back_populates="featured_bookings")
```

**Step 2: Add relationship to User model**

In `backend/app/models/user.py`, add import in TYPE_CHECKING:
```python
    from .featured_booking import FeaturedBooking
```

Add relationship after preferences:
```python
    featured_bookings: list["FeaturedBooking"] = Relationship(back_populates="organizer")
```

**Step 3: Add is_trusted_organizer to User model**

In `backend/app/models/user.py`, add field after is_admin:
```python
    is_trusted_organizer: bool = Field(default=False)
```

**Step 4: Export from __init__**

In `backend/app/models/__init__.py`, add:
```python
from .featured_booking import FeaturedBooking, SlotType, BookingStatus, SLOT_CONFIG
```

**Step 5: Commit**

```bash
git add backend/app/models/featured_booking.py backend/app/models/user.py backend/app/models/__init__.py
git commit -m "feat: add FeaturedBooking model and trusted organizer flag"
```

---

## Task 3: Create Featured Service

**Files:**
- Create: `backend/app/services/featured.py`

**Step 1: Create the service**

Create `backend/app/services/featured.py`:

```python
"""
Featured booking service.
Handles availability checks, pricing, and Stripe checkout creation.
"""
from datetime import date, datetime, timedelta
from typing import Optional
import stripe
from sqlmodel import Session, select, and_, or_

from app.core.config import settings
from app.models.featured_booking import (
    FeaturedBooking, SlotType, BookingStatus, SLOT_CONFIG
)
from app.models.event import Event
from app.models.user import User

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


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
    config = SLOT_CONFIG[slot_type]
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
    target_id: Optional[str] = None
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
        amount_paid=amount
    )
    session.add(booking)
    session.commit()
    session.refresh(booking)

    # Create Stripe Checkout Session
    slot_name = slot_type.value.replace("_", " ").title()

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
        cancel_url=f"{settings.FRONTEND_URL}/events/{event.id}/promote?cancelled=true",
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
    Updates booking status based on organizer trust level.
    """
    booking_id = stripe_session.get("metadata", {}).get("booking_id")
    if not booking_id:
        return

    booking = session.get(FeaturedBooking, booking_id)
    if not booking:
        return

    # Get payment intent ID
    booking.stripe_payment_intent_id = stripe_session.get("payment_intent")

    # Check if organizer is trusted
    organizer = session.get(User, booking.organizer_id)
    if organizer and organizer.is_trusted_organizer:
        booking.status = BookingStatus.ACTIVE
    else:
        booking.status = BookingStatus.PENDING_APPROVAL

    booking.updated_at = datetime.utcnow()
    session.add(booking)
    session.commit()


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
```

**Step 2: Commit**

```bash
git add backend/app/services/featured.py
git commit -m "feat: add featured booking service with availability and Stripe"
```

---

## Task 4: Create Featured API Endpoints

**Files:**
- Create: `backend/app/api/featured.py`
- Modify: `backend/app/main.py`

**Step 1: Create the API router**

Create `backend/app/api/featured.py`:

```python
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
from app.services.featured import (
    check_availability,
    create_checkout_session,
    handle_checkout_completed,
    handle_checkout_expired,
    get_active_featured
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
def get_slot_config():
    """Get pricing and limits for all slot types."""
    return [
        SlotConfigResponse(
            slot_type=slot_type.value,
            max_slots=config["max"],
            price_per_day=config["price_per_day"],
            min_days=config["min_days"]
        )
        for slot_type, config in SLOT_CONFIG.items()
    ]


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
    # Verify event exists and user owns it
    event = session.get(Event, request.event_id)
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
```

**Step 2: Register router in main.py**

In `backend/app/main.py`, add to imports:
```python
from app.api import featured
```

Add router registration:
```python
app.include_router(featured.router, prefix="/api/featured", tags=["Featured"])
```

**Step 3: Commit**

```bash
git add backend/app/api/featured.py backend/app/main.py
git commit -m "feat: add featured booking API endpoints"
```

---

## Task 5: Create Admin Featured Endpoints

**Files:**
- Modify: `backend/app/api/admin.py`

**Step 1: Add admin featured endpoints**

In `backend/app/api/admin.py`, add imports at top:
```python
from app.models.featured_booking import FeaturedBooking, BookingStatus
from app.services.resend_email import resend_email_service
import stripe
from app.core.config import settings
```

Add these endpoints:

```python
# ============================================================
# FEATURED BOOKINGS ADMIN
# ============================================================

@router.get("/featured")
def get_all_featured_bookings(
    status: Optional[str] = None,
    slot_type: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin)
):
    """Get all featured bookings with optional filters."""
    query = select(FeaturedBooking).order_by(FeaturedBooking.created_at.desc())

    if status:
        query = query.where(FeaturedBooking.status == status)
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
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin)
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
            organizer.display_name,
            event_title,
            "approved",
            ""  # No unsubscribe token needed for this
        )

    return {"status": "approved", "booking_id": booking_id}


@router.patch("/featured/{booking_id}/reject")
def reject_featured_booking(
    booking_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin)
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
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin)
):
    """Toggle trusted organizer status for a user."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_trusted_organizer = trusted
    session.add(user)
    session.commit()

    return {"user_id": user_id, "is_trusted_organizer": trusted}
```

**Step 2: Commit**

```bash
git add backend/app/api/admin.py
git commit -m "feat: add admin endpoints for featured booking management"
```

---

## Task 6: Add Frontend Types and API

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add types**

In `frontend/src/types/index.ts`, add:

```typescript
// ============================================================
// FEATURED BOOKING TYPES
// ============================================================

export type SlotType = 'hero_home' | 'global_pinned' | 'category_pinned' | 'newsletter';
export type BookingStatus = 'pending_payment' | 'pending_approval' | 'active' | 'completed' | 'cancelled' | 'rejected';

export interface SlotConfig {
  slot_type: string;
  max_slots: number;
  price_per_day: number;
  min_days: number;
}

export interface AvailabilityRequest {
  slot_type: SlotType;
  start_date: string;
  end_date: string;
  target_id?: string;
}

export interface AvailabilityResponse {
  available: boolean;
  unavailable_dates: string[];
  slots_remaining: Record<string, number>;
  price_quote: number;
  num_days: number;
  error?: string;
}

export interface CheckoutRequest {
  event_id: string;
  slot_type: SlotType;
  start_date: string;
  end_date: string;
  target_id?: string;
}

export interface CheckoutResponse {
  checkout_url: string;
  booking_id: string;
}

export interface FeaturedBooking {
  id: string;
  event_id: string;
  event_title?: string;
  slot_type: SlotType;
  target_id?: string;
  start_date: string;
  end_date: string;
  status: BookingStatus;
  amount_paid: number;
  created_at: string;
}

export interface ActiveFeatured {
  id: string;
  event_id: string;
  event_title: string;
  event_image_url?: string;
  slot_type: SlotType;
  start_date: string;
  end_date: string;
}
```

**Step 2: Add API methods**

In `frontend/src/lib/api.ts`, add the types to imports and add:

```typescript
// ============================================================
// FEATURED API
// ============================================================

const featuredAPI = {
  async getConfig(): Promise<SlotConfig[]> {
    const response = await fetch(`${API_BASE_URL}/featured/config`);
    if (!response.ok) throw new Error('Failed to fetch config');
    return response.json();
  },

  async checkAvailability(request: AvailabilityRequest): Promise<AvailabilityResponse> {
    const response = await fetch(`${API_BASE_URL}/featured/check-availability`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error('Failed to check availability');
    return response.json();
  },

  async createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    const response = await fetch(`${API_BASE_URL}/featured/create-checkout`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create checkout');
    }
    return response.json();
  },

  async getMyBookings(): Promise<FeaturedBooking[]> {
    const response = await fetch(`${API_BASE_URL}/featured/my-bookings`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch bookings');
    return response.json();
  },

  async getActive(slotType: SlotType, targetId?: string): Promise<ActiveFeatured[]> {
    const params = new URLSearchParams({ slot_type: slotType });
    if (targetId) params.append('target_id', targetId);

    const response = await fetch(`${API_BASE_URL}/featured/active?${params}`);
    if (!response.ok) throw new Error('Failed to fetch active featured');
    return response.json();
  },
};
```

Add to the `api` export object:
```typescript
export const api = {
  // ... existing
  featured: featuredAPI,
};
```

**Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/api.ts
git commit -m "feat: add featured booking types and API client"
```

---

## Task 7: Create Promote Event Page

**Files:**
- Create: `frontend/src/pages/events/[id]/promote.tsx`

**Step 1: Create the promote page**

Create `frontend/src/pages/events/[id]/promote.tsx`:

```tsx
/**
 * Promote Event Page
 * Allows organizers to purchase featured placement for their events
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { EventResponse, SlotConfig, SlotType, AvailabilityResponse, Category } from '@/types';

const SLOT_DESCRIPTIONS: Record<SlotType, { name: string; description: string }> = {
  hero_home: { name: 'Hero Carousel', description: 'Maximum visibility on homepage' },
  global_pinned: { name: 'Homepage Pinned', description: 'Top of all events list' },
  category_pinned: { name: 'Category Pinned', description: 'Top of category page' },
  newsletter: { name: 'Weekly Newsletter', description: 'Featured in Thursday digest' },
};

export default function PromoteEventPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isAuthenticated } = useAuth();

  const [event, setEvent] = useState<EventResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [slotConfigs, setSlotConfigs] = useState<SlotConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedSlot, setSelectedSlot] = useState<SlotType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  useEffect(() => {
    // Check availability when dates or slot changes
    if (selectedSlot && startDate && endDate) {
      checkAvailability();
    }
  }, [selectedSlot, selectedCategory, startDate, endDate]);

  const loadData = async () => {
    try {
      const [eventData, configData, categoriesData] = await Promise.all([
        api.events.get(id as string),
        api.featured.getConfig(),
        api.categories.list(),
      ]);
      setEvent(eventData);
      setSlotConfigs(configData);
      setCategories(categoriesData.categories || []);

      // Set default dates (tomorrow to 3 days from now)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const threeDays = new Date();
      threeDays.setDate(threeDays.getDate() + 4);
      setStartDate(tomorrow.toISOString().split('T')[0]);
      setEndDate(threeDays.toISOString().split('T')[0]);
    } catch (err) {
      setError('Failed to load event');
    } finally {
      setIsLoading(false);
    }
  };

  const checkAvailability = async () => {
    if (!selectedSlot || !startDate || !endDate) return;

    setIsChecking(true);
    try {
      const result = await api.featured.checkAvailability({
        slot_type: selectedSlot,
        start_date: startDate,
        end_date: endDate,
        target_id: selectedSlot === 'category_pinned' ? selectedCategory || undefined : undefined,
      });
      setAvailability(result);
    } catch (err) {
      console.error('Availability check failed:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSlot || !startDate || !endDate || !availability?.available) return;

    setIsSubmitting(true);
    try {
      const result = await api.featured.createCheckout({
        event_id: id as string,
        slot_type: selectedSlot,
        start_date: startDate,
        end_date: endDate,
        target_id: selectedSlot === 'category_pinned' ? selectedCategory || undefined : undefined,
      });

      // Redirect to Stripe Checkout
      window.location.href = result.checkout_url;
    } catch (err: any) {
      setError(err.message || 'Failed to create checkout');
      setIsSubmitting(false);
    }
  };

  const getSlotConfig = (slotType: SlotType) => {
    return slotConfigs.find(c => c.slot_type === slotType);
  };

  const formatPrice = (pence: number) => {
    return `£${(pence / 100).toFixed(2)}`;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to promote events</p>
          <Link href="/login" className="text-emerald-600 hover:underline">Sign In</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Event not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/events/${id}`} className="text-emerald-600 hover:underline text-sm mb-2 inline-block">
            ← Back to event
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Promote Your Event</h1>
          <p className="text-gray-600 mt-1">{event.title}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
        )}

        {/* Slot Selection */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Placement</h2>
          <div className="space-y-3">
            {(['hero_home', 'global_pinned', 'category_pinned'] as SlotType[]).map(slotType => {
              const config = getSlotConfig(slotType);
              const info = SLOT_DESCRIPTIONS[slotType];
              if (!config) return null;

              return (
                <label
                  key={slotType}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedSlot === slotType
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="slot"
                      value={slotType}
                      checked={selectedSlot === slotType}
                      onChange={() => setSelectedSlot(slotType)}
                      className="sr-only"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{info.name}</p>
                      <p className="text-sm text-gray-500">{info.description}</p>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {formatPrice(config.price_per_day)}/day
                  </p>
                </label>
              );
            })}
          </div>

          {/* Category Selection for Category Pinned */}
          {selectedSlot === 'category_pinned' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Category
              </label>
              <select
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg"
              >
                <option value="">Choose a category...</option>
                {categories.filter(c => c.is_active).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Date Selection */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Dates</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full p-3 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full p-3 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* Availability Status */}
          {isChecking && (
            <p className="mt-4 text-gray-500 text-sm">Checking availability...</p>
          )}
          {availability && !isChecking && (
            <div className={`mt-4 p-4 rounded-lg ${
              availability.available ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {availability.available ? (
                <p>✓ Dates available</p>
              ) : (
                <p>✗ {availability.error || `Some dates unavailable: ${availability.unavailable_dates.join(', ')}`}</p>
              )}
            </div>
          )}
        </div>

        {/* Price Summary */}
        {availability?.available && selectedSlot && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex justify-between items-center text-lg">
              <span className="text-gray-700">
                {availability.num_days} days × {formatPrice(getSlotConfig(selectedSlot)?.price_per_day || 0)}/day
              </span>
              <span className="font-bold text-gray-900 text-2xl">
                {formatPrice(availability.price_quote)}
              </span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!availability?.available || isSubmitting || (selectedSlot === 'category_pinned' && !selectedCategory)}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
            availability?.available && !isSubmitting
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? 'Redirecting to payment...' : 'Proceed to Payment'}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/events/[id]/promote.tsx
git commit -m "feat: add promote event page with Stripe checkout"
```

---

## Task 8: Add Promote Button to Event Page

**Files:**
- Modify: `frontend/src/pages/events/[id].tsx`

**Step 1: Add promote button**

In the event detail page, find where action buttons are rendered for the event owner. Add a "Promote" button:

```tsx
{/* Add this where owner actions are shown */}
{isOwner && (
  <Link
    href={`/events/${event.id}/promote`}
    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-md"
  >
    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
    Promote
  </Link>
)}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/events/[id].tsx
git commit -m "feat: add promote button to event detail page"
```

---

## Task 9: Integrate Paid Hero Slots

**Files:**
- Modify: Frontend hero component to check for paid slots first

Find the hero carousel component and modify it to:
1. First fetch `/api/featured/active?slot_type=hero_home`
2. If results exist, display those
3. If empty, fall back to manual hero slots

The specific file depends on your current implementation. Look for the hero carousel in:
- `frontend/src/components/home/HeroCarousel.tsx` or similar
- `frontend/src/pages/index.tsx` if inline

**Step 1: Update hero logic**

```tsx
// Add at top of component
const [paidHeroEvents, setPaidHeroEvents] = useState<ActiveFeatured[]>([]);

useEffect(() => {
  // Check for paid hero slots first
  api.featured.getActive('hero_home')
    .then(data => setPaidHeroEvents(data))
    .catch(() => setPaidHeroEvents([]));
}, []);

// In render, prioritize paid slots
const heroItems = paidHeroEvents.length > 0
  ? paidHeroEvents.map(f => ({ ... }))  // Map to hero format
  : manualHeroSlots;  // Fall back to manual
```

**Step 2: Commit**

```bash
git add frontend/src/components/...  # or wherever hero is
git commit -m "feat: prioritize paid hero slots over manual"
```

---

## Task 10: Add Featured Badge to Event Lists

**Files:**
- Modify: Event card component to show "Featured" badge for pinned events

Find the event card/list component and add:

```tsx
// Add "Featured" badge for pinned events
{isFeatured && (
  <span className="absolute top-2 right-2 px-2 py-1 bg-amber-400 text-amber-900 text-xs font-bold rounded">
    Featured
  </span>
)}
```

**Step 1: Commit after changes**

```bash
git add frontend/src/components/...
git commit -m "feat: add Featured badge to promoted events"
```

---

## Task 11: Create Admin Featured Dashboard

**Files:**
- Create: `frontend/src/pages/admin/featured.tsx`

Create admin page to:
- List all featured bookings with status filters
- Approve/Reject pending bookings
- View revenue summary

**Step 1: Commit**

```bash
git add frontend/src/pages/admin/featured.tsx
git commit -m "feat: add admin featured bookings dashboard"
```

---

## Task 12: Create Expiry Background Script

**Files:**
- Create: `backend/app/scripts/expire_pending_bookings.py`

```python
"""
Background script to expire pending payment bookings.
Run via cron every 5 minutes.

Usage: cd backend && python -m app.scripts.expire_pending_bookings
"""
from datetime import datetime, timedelta
from sqlmodel import Session, select
from app.core.database import engine
from app.models.featured_booking import FeaturedBooking, BookingStatus


def expire_pending_bookings():
    """Cancel bookings stuck in PENDING_PAYMENT for over 30 minutes."""
    cutoff = datetime.utcnow() - timedelta(minutes=30)

    with Session(engine) as session:
        pending = session.exec(
            select(FeaturedBooking).where(
                FeaturedBooking.status == BookingStatus.PENDING_PAYMENT,
                FeaturedBooking.created_at < cutoff
            )
        ).all()

        print(f"Found {len(pending)} expired pending bookings")

        for booking in pending:
            booking.status = BookingStatus.CANCELLED
            booking.updated_at = datetime.utcnow()
            session.add(booking)

        session.commit()
        print(f"Expired {len(pending)} bookings")


if __name__ == "__main__":
    expire_pending_bookings()
```

**Step 1: Commit**

```bash
git add backend/app/scripts/expire_pending_bookings.py
git commit -m "feat: add script to expire pending payment bookings"
```

---

## Task 13: Set Up Stripe Webhook

**Manual Step - Not Code:**

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-api.onrender.com/api/featured/webhook`
3. Select events:
   - `checkout.session.completed`
   - `checkout.session.expired`
4. Copy the webhook signing secret
5. Add to .env: `STRIPE_WEBHOOK_SECRET=whsec_xxx`
6. Redeploy to Render

---

## Task 14: Final Integration Test

**Steps:**
1. Start backend and frontend locally
2. Create a test event
3. Go to `/events/{id}/promote`
4. Select Hero slot, dates
5. Complete Stripe test payment (card: 4242 4242 4242 4242)
6. Verify booking appears in admin
7. Approve booking
8. Verify event appears in hero carousel

---

## Summary

12 code tasks + 2 manual tasks:
1. ✅ Stripe package
2. ✅ FeaturedBooking model
3. ✅ Featured service
4. ✅ Featured API
5. ✅ Admin endpoints
6. ✅ Frontend types/API
7. ✅ Promote page
8. ✅ Promote button
9. ✅ Hero integration
10. ✅ Featured badge
11. ✅ Admin dashboard
12. ✅ Expiry script
13. 🔧 Stripe webhook (manual)
14. 🧪 Integration test
