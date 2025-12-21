"""
Payments service for Stripe integration (Phase 2).
Handles checkout session creation and webhook processing.
"""
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
import stripe
from sqlmodel import Session

from app.core.config import settings
from app.models.payment import Payment, PaymentStatus
from app.models.event import Event


# Initialize Stripe
if settings.STRIPE_SECRET_KEY:
    stripe.api_key = settings.STRIPE_SECRET_KEY


def create_checkout_session(
    session: Session,
    event_id: UUID,
    user_id: UUID,
    amount: int,
    currency: str = "gbp",
    success_url: str = "",
    cancel_url: str = ""
) -> tuple[str, str, UUID]:
    """
    Create a Stripe Checkout session for featured event listing.

    Args:
        session: Database session
        event_id: Event UUID to feature
        user_id: User UUID making payment
        amount: Amount in cents
        currency: Currency code (default "gbp")
        success_url: URL to redirect on success
        cancel_url: URL to redirect on cancel

    Returns:
        Tuple of (session_id, session_url, payment_id)
    """
    if not stripe.api_key:
        raise ValueError("Stripe is not configured")

    # Get event details
    event = session.get(Event, event_id)
    if not event:
        raise ValueError("Event not found")

    # Create payment record
    payment = Payment(
        user_id=user_id,
        event_id=event_id,
        stripe_payment_intent_id="",  # Will be updated after checkout
        amount=amount,
        currency=currency,
        status=PaymentStatus.PENDING,
        description=f"Featured listing for: {event.title}"
    )
    session.add(payment)
    session.commit()
    session.refresh(payment)

    # Create Stripe Checkout session
    checkout_session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": currency,
                    "product_data": {
                        "name": f"Featured Event: {event.title}",
                        "description": "Promote your event to the top of listings",
                    },
                    "unit_amount": amount,
                },
                "quantity": 1,
            }
        ],
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "payment_id": str(payment.id),
            "event_id": str(event_id),
            "user_id": str(user_id),
        },
    )

    # Update payment with session info
    payment.stripe_payment_intent_id = checkout_session.payment_intent or checkout_session.id
    session.add(payment)
    session.commit()

    return (checkout_session.id, checkout_session.url, payment.id)


def handle_webhook_event(
    session: Session,
    event_type: str,
    event_data: dict
) -> bool:
    """
    Handle Stripe webhook events.

    Args:
        session: Database session
        event_type: Stripe event type
        event_data: Event data from Stripe

    Returns:
        True if handled successfully, False otherwise
    """
    if event_type == "checkout.session.completed":
        # Extract metadata
        metadata = event_data.get("metadata", {})
        payment_id = metadata.get("payment_id")
        event_id = metadata.get("event_id")

        if not payment_id or not event_id:
            return False

        # Update payment status
        payment = session.get(Payment, UUID(payment_id))
        if payment:
            payment.status = PaymentStatus.COMPLETED
            payment.updated_at = datetime.utcnow()
            session.add(payment)

            # Mark event as featured for 30 days
            event = session.get(Event, UUID(event_id))
            if event:
                event.featured = True
                event.featured_until = datetime.utcnow() + timedelta(days=30)
                session.add(event)

            session.commit()
            return True

    elif event_type == "payment_intent.payment_failed":
        # Handle failed payment
        payment_intent_id = event_data.get("id")
        if payment_intent_id:
            payment = session.exec(
                session.query(Payment).filter(
                    Payment.stripe_payment_intent_id == payment_intent_id
                )
            ).first()

            if payment:
                payment.status = PaymentStatus.FAILED
                payment.updated_at = datetime.utcnow()
                session.add(payment)
                session.commit()
                return True

    return False


def get_user_payments(
    session: Session,
    user_id: UUID,
    skip: int = 0,
    limit: int = 50
) -> list[Payment]:
    """
    Get payment history for a user.

    Args:
        session: Database session
        user_id: User UUID
        skip: Number of records to skip
        limit: Max records to return

    Returns:
        List of payments
    """
    payments = session.exec(
        session.query(Payment)
        .filter(Payment.user_id == user_id)
        .order_by(Payment.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()

    return payments
