from __future__ import annotations
import stripe
import json
import secrets
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union, Tuple
from sqlmodel import Session, select, or_
from app.core.config import settings
from app.models import OrganizerStripeAccount, User, Order, TicketTier, Ticket, PromoCode, Event
from app.services.ticket_inventory import consume_order_reservations, release_order_reservations

logger = logging.getLogger(__name__)

if settings.STRIPE_SECRET_KEY:
    stripe.api_key = settings.STRIPE_SECRET_KEY

def create_connect_account(email: str, country: str = "GB") -> str:
    """
    Creates a Stripe Standard account and returns the account ID.
    """
    if not settings.STRIPE_SECRET_KEY:
        raise ValueError("STRIPE_SECRET_KEY is not configured")
        
    account = stripe.Account.create(
        type="standard",
        email=email,
        country=country
    )
    return account.id

def create_account_onboarding_link(stripe_account_id: str, refresh_url: str, return_url: str) -> str:
    """
    Generates a Stripe AccountLink for onboarding.
    """
    if not settings.STRIPE_SECRET_KEY:
        raise ValueError("STRIPE_SECRET_KEY is not configured")
        
    account_link = stripe.AccountLink.create(
        account=stripe_account_id,
        refresh_url=refresh_url,
        return_url=return_url,
        type="account_onboarding"
    )
    return account_link.url

def sync_account_status(stripe_account_id: str, session: Session) -> OrganizerStripeAccount:
    """
    Fetches account details from Stripe, updates charges_enabled and payouts_enabled
    in the database, and returns the updated model.
    Also updates the user's seller status if charges are enabled.
    """
    if not settings.STRIPE_SECRET_KEY:
        raise ValueError("STRIPE_SECRET_KEY is not configured")
        
    # Fetch from Stripe
    stripe_account = stripe.Account.retrieve(stripe_account_id)
    
    # Fetch from DB
    statement = select(OrganizerStripeAccount).where(OrganizerStripeAccount.stripe_account_id == stripe_account_id)
    db_account = session.exec(statement).first()
    
    if not db_account:
        raise ValueError(f"OrganizerStripeAccount not found for stripe_account_id: {stripe_account_id}")
        
    # Update status flags
    db_account.charges_enabled = bool(getattr(stripe_account, "charges_enabled", False))
    db_account.payouts_enabled = bool(getattr(stripe_account, "payouts_enabled", False))
    
    session.add(db_account)
    
    # Auto-verify organizer and user when Stripe connection is active
    is_active = (
        db_account.charges_enabled or 
        db_account.payouts_enabled or 
        bool(getattr(stripe_account, "details_submitted", False))
    )
    
    organizer = db_account.organizer or session.get(Organizer, db_account.organizer_profile_id)
    if organizer and is_active:
        organizer.is_verified = True
        session.add(organizer)
        
        user = organizer.user or session.get(User, organizer.user_id)
        if user:
            user.seller_tier = 2
            if user.seller_status not in ["frozen", "rejected"]:
                user.seller_status = "approved"
            session.add(user)
    
    session.commit()
    session.refresh(db_account)
    
    return db_account

@dataclass
class FulfillmentResult:
    order: Order
    newly_fulfilled: bool


def _intent_metadata(intent: Any) -> Dict[str, Any]:
    metadata = getattr(intent, "metadata", {}) or {}
    if hasattr(metadata, "to_dict"):
        return metadata.to_dict()
    if isinstance(metadata, dict):
        return metadata
    try:
        return dict(metadata)
    except Exception:
        return {}


def _retrieve_payment_intent(intent_id: str, stripe_account_id: Optional[str]) -> Any:
    if not settings.STRIPE_SECRET_KEY:
        return None
    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        return stripe.PaymentIntent.retrieve(intent_id, stripe_account=stripe_account_id)
    except stripe.error.InvalidRequestError:
        return None
    except Exception as exc:
        logger.warning("Unable to reconcile PaymentIntent %s: %s", intent_id, exc)
        return None


def _fulfill_reserved_order(
    intent: Any,
    session: Session,
    order_id: str,
    stripe_account_id: Optional[str],
) -> Optional[FulfillmentResult]:
    order = session.exec(select(Order).where(Order.id == order_id).with_for_update()).first()
    if not order:
        return None
    if not stripe_account_id or stripe_account_id != order.stripe_account_id:
        logger.error("Connected-account mismatch while fulfilling order %s", order.id)
        return None
    if order.status == "completed":
        return FulfillmentResult(order=order, newly_fulfilled=False)
    if order.status not in {"pending_payment", "payment_intent_uncertain"}:
        logger.warning("Order %s cannot be fulfilled from status %s", order.id, order.status)
        return None
    pi_id = getattr(intent, "id", None)
    if not pi_id or order.stripe_payment_intent_id not in (None, pi_id):
        logger.error("PaymentIntent mismatch while fulfilling order %s", order.id)
        return None
    if int(getattr(intent, "amount", -1)) != int(round(order.total_amount * 100)):
        logger.error("Payment amount mismatch while fulfilling order %s", order.id)
        return None
    if str(getattr(intent, "currency", "")).lower() != "gbp":
        logger.error("Payment currency mismatch while fulfilling order %s", order.id)
        return None

    order.stripe_payment_intent_id = pi_id
    consume_order_reservations(session, order)
    if order.promo_code:
        promo = session.exec(
            select(PromoCode)
            .where(PromoCode.event_id == order.event_id, PromoCode.code_text == order.promo_code)
            .with_for_update()
        ).first()
        if promo:
            promo.usage_count += 1
            session.add(promo)
    order.status = "completed"
    order.updated_at = datetime.utcnow()
    session.add(order)
    session.commit()
    session.refresh(order)
    return FulfillmentResult(order=order, newly_fulfilled=True)


def _fulfill_legacy_payment_intent(intent: Any, session: Session) -> Optional[FulfillmentResult]:
    """Compatibility path for PaymentIntents created before reservations existed."""
    pi_id = getattr(intent, "id", None)
    existing = session.exec(select(Order).where(Order.stripe_payment_intent_id == pi_id)).first()
    if existing:
        return FulfillmentResult(order=existing, newly_fulfilled=False)

    metadata = _intent_metadata(intent)
    event_id = metadata.get("event_id")
    if not event_id:
        return None
    try:
        raw_items = metadata.get("items_json", "[]")
        items_payload = raw_items if isinstance(raw_items, list) else json.loads(raw_items)
        tier_ids = sorted({item.get("tier_id") for item in items_payload if item.get("tier_id")})
        tiers = session.exec(
            select(TicketTier).where(TicketTier.id.in_(tier_ids)).order_by(TicketTier.id).with_for_update()
        ).all()
        tier_map = {tier.id: tier for tier in tiers}
        tier_items = []
        for item in items_payload:
            tier = tier_map.get(item.get("tier_id"))
            if not tier:
                continue
            quantity = int(item.get("quantity", 1))
            tier.quantity_sold += quantity
            session.add(tier)
            tier_items.append((tier, quantity))

        promo_code = metadata.get("promo_code")
        if promo_code:
            promo = session.exec(
                select(PromoCode)
                .where(PromoCode.event_id == event_id, PromoCode.code_text == promo_code)
                .with_for_update()
            ).first()
            if promo:
                promo.usage_count += 1
                session.add(promo)

        order_ref = "HEH-" + secrets.token_hex(3).upper()
        while session.exec(select(Order).where(Order.order_ref == order_ref)).first():
            order_ref = "HEH-" + secrets.token_hex(3).upper()
        total_amount = float(getattr(intent, "amount", 0) or 0) / 100.0
        app_fee = getattr(intent, "application_fee_amount", None)
        platform_fee_amount = (
            float(app_fee) / 100.0
            if app_fee is not None and app_fee > 0
            else float(metadata.get("platform_fee_amount", 0) or 0)
        )
        buyer_email = metadata.get("buyer_email") or getattr(intent, "receipt_email", None) or ""
        buyer_name = metadata.get("buyer_name") or "Ticket Buyer"
        buyer_user_id = metadata.get("buyer_user_id") or None
        if not buyer_user_id and buyer_email:
            from sqlalchemy import func
            matching_user = session.exec(
                select(User).where(func.lower(User.email) == buyer_email.strip().lower())
            ).first()
            buyer_user_id = matching_user.id if matching_user else None
        raw_responses = metadata.get("attendee_responses") or "{}"
        attendee_responses = raw_responses if isinstance(raw_responses, dict) else json.loads(raw_responses)
        order = Order(
            order_ref=order_ref,
            event_id=event_id,
            buyer_user_id=buyer_user_id,
            buyer_email=buyer_email,
            buyer_name=buyer_name,
            buyer_phone=metadata.get("buyer_phone"),
            total_amount=total_amount,
            subtotal_amount=max(0.0, total_amount - platform_fee_amount),
            platform_fee_amount=platform_fee_amount,
            stripe_payment_intent_id=pi_id,
            status="completed",
            attendee_responses=attendee_responses,
        )
        session.add(order)
        session.flush()
        for tier, quantity in tier_items:
            for _ in range(quantity):
                session.add(Ticket(
                    order_id=order.id,
                    tier_id=tier.id,
                    qr_token=secrets.token_urlsafe(48),
                    status="valid",
                ))
        session.commit()
        session.refresh(order)
        logger.warning("Fulfilled legacy unreserved PaymentIntent %s", pi_id)
        return FulfillmentResult(order=order, newly_fulfilled=True)
    except Exception as exc:
        session.rollback()
        logger.error("Legacy PaymentIntent fulfillment failed for %s: %s", pi_id, exc)
        return None


def fulfill_payment_intent(
    intent_or_id: Any,
    session: Session,
    stripe_account_id: Optional[str] = None,
) -> Optional[FulfillmentResult]:
    intent = (
        _retrieve_payment_intent(intent_or_id, stripe_account_id)
        if isinstance(intent_or_id, str)
        else intent_or_id
    )
    if not intent or getattr(intent, "status", "") != "succeeded":
        return None

    metadata = _intent_metadata(intent)
    order_id = metadata.get("ticket_order_id")
    if not order_id:
        existing = session.exec(
            select(Order).where(Order.stripe_payment_intent_id == getattr(intent, "id", None))
        ).first()
        if existing and existing.checkout_attempt_id:
            order_id = existing.id
    if order_id:
        try:
            return _fulfill_reserved_order(intent, session, order_id, stripe_account_id)
        except Exception as exc:
            session.rollback()
            logger.error("Reserved PaymentIntent fulfillment failed for %s: %s", getattr(intent, "id", None), exc)
            return None
    return _fulfill_legacy_payment_intent(intent, session)


def reconcile_payment_intent(
    intent_or_id: Any,
    session: Session,
    stripe_account_id: Optional[str] = None,
) -> str:
    """Reconcile without releasing stock for processing, uncertain, or unavailable payments."""
    intent = (
        _retrieve_payment_intent(intent_or_id, stripe_account_id)
        if isinstance(intent_or_id, str)
        else intent_or_id
    )
    if not intent:
        return "unresolved"
    if getattr(intent, "status", "") == "succeeded":
        result = fulfill_payment_intent(intent, session, stripe_account_id)
        if not result:
            return "unresolved"
        return "fulfilled" if result.newly_fulfilled else "already_fulfilled"

    metadata = _intent_metadata(intent)
    order_id = metadata.get("ticket_order_id")
    if not order_id:
        existing = session.exec(
            select(Order).where(Order.stripe_payment_intent_id == getattr(intent, "id", None))
        ).first()
        order_id = existing.id if existing and existing.checkout_attempt_id else None
    if not order_id:
        return "legacy"

    order = session.exec(select(Order).where(Order.id == order_id).with_for_update()).first()
    if not order or order.status not in {"pending_payment", "payment_intent_uncertain"}:
        return order.status if order else "missing"
    if not stripe_account_id or stripe_account_id != order.stripe_account_id:
        session.rollback()
        return "account_mismatch"
    if getattr(intent, "status", "") != "canceled":
        session.rollback()
        return "retained"

    release_order_reservations(session, order)
    order.status = "failed"
    order.updated_at = datetime.utcnow()
    session.add(order)
    session.commit()
    return "released"


def recover_uncertain_payment_intent(
    order_id: str,
    intent_id: str,
    session: Session,
) -> str:
    """Attach and reconcile an operator-verified PaymentIntent without creating one."""
    order = session.get(Order, order_id)
    if not order:
        raise ValueError(f"Order {order_id} was not found")
    if order.status not in {"pending_payment", "payment_intent_uncertain", "completed"}:
        raise ValueError(f"Order {order_id} cannot be recovered from status {order.status}")
    if not order.stripe_account_id:
        raise ValueError(f"Order {order_id} has no connected Stripe account")

    stripe_account_id = order.stripe_account_id
    expected_amount = int(round(order.total_amount * 100))
    session.rollback()
    intent = _retrieve_payment_intent(intent_id, stripe_account_id)
    if not intent:
        raise ValueError(
            f"PaymentIntent {intent_id} could not be retrieved from {stripe_account_id}"
        )
    metadata = _intent_metadata(intent)
    if metadata.get("ticket_order_id") != order_id:
        raise ValueError("PaymentIntent metadata does not identify the requested order")
    if int(getattr(intent, "amount", -1)) != expected_amount:
        raise ValueError("PaymentIntent amount does not match the order")
    if str(getattr(intent, "currency", "")).lower() != "gbp":
        raise ValueError("PaymentIntent currency does not match the order")

    locked_order = session.exec(
        select(Order).where(Order.id == order_id).with_for_update()
    ).first()
    if not locked_order:
        session.rollback()
        raise ValueError(f"Order {order_id} was not found")
    if locked_order.stripe_payment_intent_id not in (None, intent_id):
        session.rollback()
        raise ValueError("Order is already associated with a different PaymentIntent")
    locked_order.stripe_payment_intent_id = intent_id
    locked_order.updated_at = datetime.utcnow()
    session.add(locked_order)
    session.commit()

    return reconcile_payment_intent(
        intent,
        session,
        stripe_account_id=stripe_account_id,
    )


async def dispatch_order_confirmation_emails(
    order_or_id: Union[Order, str],
    session: Optional[Session] = None
) -> bool:
    """
    Asynchronously sends booking confirmation email to buyer (including event title,
    date/time, venue, ticket tier name, amount paid, and digital ticket link) and sale notification
    to organizer, and creates in-app notification for the organizer.
    """
    from app.core.database import engine
    from sqlmodel import Session as DbSession
    from app.models.event import Event
    from app.models.ticket import Ticket
    from app.models.ticket_tier import TicketTier
    from app.models.user import User
    from app.services.resend_email import resend_email_service

    def _execute(db_session: Session) -> Tuple[Optional[Order], Optional[Event], List[Ticket], Dict[str, Dict[str, Any]], Optional[str], Optional[str], Optional[str]]:
        if isinstance(order_or_id, str):
            ord_obj = db_session.get(Order, order_or_id)
        else:
            ord_obj = db_session.get(Order, order_or_id.id) if order_or_id else None

        if not ord_obj:
            return None, None, [], {}, None, None, None

        evt = db_session.get(Event, ord_obj.event_id)
        tix = db_session.exec(select(Ticket).where(Ticket.order_id == ord_obj.id)).all()
        t_counts: Dict[str, Dict[str, Any]] = {}
        for t in tix:
            tier = db_session.get(TicketTier, t.tier_id) if t.tier_id else None
            t_name = tier.name if tier else "General Admission"
            t_price = tier.price if tier else 0.0
            if t_name not in t_counts:
                t_counts[t_name] = {"name": t_name, "qty": 0, "price": t_price, "qr_tokens": []}
            t_counts[t_name]["qty"] += 1
            if t.qr_token:
                t_counts[t_name]["qr_tokens"].append(t.qr_token)

        # Organizer lookup
        org_user = db_session.get(User, evt.organizer_id) if evt and evt.organizer_id else None
        org_email = org_user.email if org_user else None
        if not org_email and evt and evt.organizer_profile:
            org_email = evt.organizer_profile.contact_email
        org_name = org_user.username if org_user else "Organizer"

        return ord_obj, evt, tix, t_counts, org_email, org_name, getattr(evt, "title", None)

    try:
        if session is None:
            with DbSession(engine) as fresh_session:
                order, event, tickets, tier_counts, organizer_email, organizer_name, event_title = _execute(fresh_session)
        else:
            order, event, tickets, tier_counts, organizer_email, organizer_name, event_title = _execute(session)

        if not order:
            logger.warning("dispatch_order_confirmation_emails: Order not found")
            return False

        event_title = event_title or "Highland Event"
        event_date_str = event.date_start.strftime("%A, %d %B %Y at %H:%M") if event and event.date_start else ""

        venue_info = ""
        if event:
            if event.venue:
                venue_info = f"{event.venue.name}, {getattr(event.venue, 'address', '')}".strip(", ")
            elif event.location_name:
                venue_info = f"{event.location_name}, {getattr(event, 'location_town', '') or ''}".strip(", ")

        ticket_summary = list(tier_counts.values())
        if not ticket_summary:
            ticket_summary = [{"name": "General Admission", "qty": len(tickets) or 1, "price": order.total_amount}]

        # 1. Send confirmation email to buyer
        if order.buyer_email:
            logger.info(f"Dispatching ticket order confirmation email to buyer {order.buyer_email} for order {order.order_ref}")
            await resend_email_service.send_ticket_order_confirmation(
                to_email=order.buyer_email,
                order_ref=order.order_ref,
                event_title=event_title,
                event_date_str=event_date_str,
                venue_info=venue_info,
                buyer_name=order.buyer_name,
                total_amount=order.total_amount,
                ticket_summary=ticket_summary
            )

        # 2. In-app notification for organizer
        try:
            target_user_id = event.organizer_id if event and event.organizer_id else None
            if not target_user_id and event and event.organizer_profile_id:
                from app.models.organizer import Organizer
                target_sess = session or (DbSession(engine) if 'fresh_session' not in locals() else fresh_session)
                org_prof = target_sess.get(Organizer, event.organizer_profile_id)
                if org_prof:
                    target_user_id = org_prof.user_id

            if target_user_id:
                from app.models.notification import Notification, NotificationType
                n_type = getattr(NotificationType, "TICKET_PURCHASED", NotificationType.SYSTEM)
                tiers_label = ", ".join(f"{item['qty']}x {item['name']}" for item in ticket_summary)
                notif_msg = f"{tiers_label} sold for {event_title} (£{order.total_amount:.2f})"
                
                if session is None:
                    with DbSession(engine) as notif_sess_fresh:
                        organizer_notif = Notification(
                            user_id=target_user_id,
                            type=n_type,
                            title="New Ticket Sale!",
                            message=notif_msg,
                            link="/organizers/hub",
                            is_read=False
                        )
                        notif_sess_fresh.add(organizer_notif)
                        notif_sess_fresh.commit()
                else:
                    organizer_notif = Notification(
                        user_id=target_user_id,
                        type=n_type,
                        title="New Ticket Sale!",
                        message=notif_msg,
                        link="/organizers/hub",
                        is_read=False
                    )
                    session.add(organizer_notif)
                    session.commit()
        except Exception as notif_err:
            logger.warning(f"Could not create in-app notification for organizer: {notif_err}")

        # 3. Email notification to organizer
        if organizer_email:
            try:
                logger.info(f"Dispatching ticket sale notification email to organizer {organizer_email} for order {order.order_ref}")
                await resend_email_service.send_organizer_ticket_sale_notification(
                    organizer_email=organizer_email,
                    organizer_name=organizer_name or "Organizer",
                    event_title=event_title,
                    event_id=event.id if event else "",
                    order_ref=order.order_ref,
                    buyer_name=order.buyer_name,
                    buyer_email=order.buyer_email,
                    tickets_breakdown=ticket_summary,
                    total_amount=order.total_amount,
                    platform_fee=order.platform_fee_amount,
                    net_amount=order.total_amount - order.platform_fee_amount
                )
            except Exception as email_err:
                logger.error(f"Failed to dispatch organizer ticket sale notification email: {email_err}", exc_info=True)

        return True
    except Exception as e:
        logger.error(f"Failed to dispatch order confirmation emails: {e}", exc_info=True)
        return False


def trigger_order_confirmation_emails(order: Union[Order, str], session: Optional[Session] = None) -> None:
    """
    Safely triggers dispatch_order_confirmation_emails from synchronous or asynchronous execution contexts.
    """
    import asyncio
    import threading

    order_id = str(order.id if hasattr(order, "id") else order)

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        loop.create_task(dispatch_order_confirmation_emails(order_id, session))
    else:
        def run_in_thread():
            asyncio.run(dispatch_order_confirmation_emails(order_id, None))

        t = threading.Thread(target=run_in_thread, daemon=True)
        t.start()


async def dispatch_rescheduled_notification_emails(
    event_id: str,
    previous_date: datetime,
    new_date: datetime,
    session: Optional[Session] = None
) -> bool:
    """
    Queries all completed orders for an event and sends reschedule notification emails to buyers.
    """
    from app.core.database import engine, get_session
    from sqlmodel import Session as DbSession
    from app.services.resend_email import resend_email_service
    from app.core.utils import normalize_uuid

    def _fetch_data(db_session: Session):
        evt = db_session.get(Event, normalize_uuid(event_id)) or db_session.get(Event, event_id)
        if not evt:
            return None, []
        orders = db_session.exec(
            select(Order).where(Order.event_id == evt.id, Order.status == "completed")
        ).all()
        return evt, orders

    try:
        if session is None:
            with DbSession(engine) as fresh_session:
                event, orders = _fetch_data(fresh_session)
        else:
            event, orders = _fetch_data(session)

        if not event or not orders:
            logger.info(f"No active orders found to notify for rescheduled event {event_id}")
            return True

        prev_date_str = previous_date.strftime("%A, %d %B %Y at %H:%M") if previous_date else "Original Date"
        new_date_str = new_date.strftime("%A, %d %B %Y at %H:%M") if new_date else "Updated Date"

        venue_info = ""
        if event.venue:
            venue_info = f"{event.venue.name}, {getattr(event.venue, 'address', '')}".strip(", ")
        elif event.location_name:
            venue_info = f"{event.location_name}, {getattr(event, 'location_town', '') or ''}".strip(", ")

        for order in orders:
            if order.buyer_email:
                try:
                    await resend_email_service.send_event_rescheduled_notification(
                        to_email=order.buyer_email,
                        buyer_name=order.buyer_name,
                        event_title=event.title,
                        previous_date_str=prev_date_str,
                        new_date_str=new_date_str,
                        venue_info=venue_info,
                        order_ref=order.order_ref,
                        event_id=event.id
                    )
                except Exception as email_err:
                    logger.error(f"Failed to send reschedule email to {order.buyer_email} for order {order.order_ref}: {email_err}")

        return True
    except Exception as e:
        logger.error(f"Failed to dispatch reschedule notification emails for event {event_id}: {e}", exc_info=True)
        return False


def trigger_rescheduled_notification_emails(
    event_id: str,
    previous_date: datetime,
    new_date: datetime,
    session: Optional[Session] = None
) -> None:
    """
    Safely triggers dispatch_rescheduled_notification_emails from sync or async contexts.
    """
    import asyncio
    import threading

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        loop.create_task(dispatch_rescheduled_notification_emails(event_id, previous_date, new_date, session))
    else:
        def run_in_thread():
            asyncio.run(dispatch_rescheduled_notification_emails(event_id, previous_date, new_date, None))

        t = threading.Thread(target=run_in_thread, daemon=True)
        t.start()


def process_event_cancellation_and_refunds(
    event_id: str,
    reason: Optional[str] = None,
    session: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Executes complete event cancellation workflow:
    1. Sets event.is_cancelled = True, sales_frozen = True, records cancellation_reason and cancelled_at timestamp.
    2. Deactivates active promotions and featured ad bookings for this event.
    3. Refunds face value of all paid completed orders via Stripe (retains platform booking fee).
    4. Marks free orders and all tickets as cancelled / refunded.
    5. Dispatches cancellation notification emails to all buyers.
    """
    from app.core.database import engine
    from sqlmodel import Session as DbSession
    from app.services.resend_email import resend_email_service
    from app.core.utils import normalize_uuid
    from app.models.promotion import Promotion
    from app.models.featured_booking import FeaturedBooking
    from app.models.organizer_stripe_account import OrganizerStripeAccount
    from app.models.organizer import Organizer
    import asyncio
    import threading

    db = session or DbSession(engine)
    should_close = session is None

    try:
        event = db.get(Event, normalize_uuid(event_id)) or db.get(Event, event_id)
        if not event:
            raise ValueError(f"Event not found: {event_id}")

        now = datetime.utcnow()
        event.is_cancelled = True
        event.sales_frozen = True
        event.cancelled_at = now
        event.cancellation_reason = reason
        db.add(event)

        # 2. Deactivate any active promotions or featured ads for this event
        try:
            bookings = db.exec(select(FeaturedBooking).where(FeaturedBooking.event_id == event.id)).all()
            for b in bookings:
                b.status = "cancelled"
                db.add(b)
        except Exception as promo_err:
            logger.warning(f"Could not deactivate promotions for cancelled event {event.id}: {promo_err}")

        # 3. Resolve Connected Stripe Account if available
        stripe_account_id = None
        if event.organizer_profile and event.organizer_profile.stripe_account:
            stripe_account_id = event.organizer_profile.stripe_account.stripe_account_id
        elif event.organizer_id:
            stmt = (
                select(OrganizerStripeAccount)
                .join(Organizer, OrganizerStripeAccount.organizer_profile_id == Organizer.id)
                .where(Organizer.user_id == event.organizer_id)
            )
            acc = db.exec(stmt).first()
            if acc:
                stripe_account_id = acc.stripe_account_id

        # 4. Fetch all orders for this event
        orders = db.exec(select(Order).where(Order.event_id == event.id)).all()
        refunded_orders_count = 0
        cancelled_orders_count = 0

        notifications_to_send = []

        for order in orders:
            # We only process completed orders (or cash orders)
            if order.status not in ["completed", "cash_door_sale"]:
                continue

            is_free = order.total_amount <= 0 or not order.stripe_payment_intent_id

            if not is_free and order.stripe_payment_intent_id:
                # Calculate face-value refund (gross total minus platform booking fee)
                face_value = max(0.0, order.total_amount - order.platform_fee_amount)
                face_value_pence = int(round(face_value * 100))

                if face_value_pence > 0 and settings.STRIPE_SECRET_KEY:
                    try:
                        stripe.api_key = settings.STRIPE_SECRET_KEY
                        refund_kwargs: Dict[str, Any] = {
                            "payment_intent": order.stripe_payment_intent_id,
                            "amount": face_value_pence,
                            "reason": "requested_by_customer"
                        }
                        if stripe_account_id:
                            refund_kwargs["stripe_account"] = stripe_account_id
                        else:
                            refund_kwargs["reverse_transfer"] = True
                        stripe.Refund.create(**refund_kwargs)
                        logger.info(f"Stripe refund of £{face_value:.2f} processed for order {order.order_ref}")
                    except Exception as refund_err:
                        logger.error(f"Stripe refund failed for order {order.order_ref} (PI: {order.stripe_payment_intent_id}): {refund_err}")

                order.status = "refunded"
                order.updated_at = now
                db.add(order)

                for ticket in order.tickets:
                    ticket.status = "refunded"
                    ticket.updated_at = now
                    db.add(ticket)

                refunded_orders_count += 1
                notifications_to_send.append({
                    "to_email": order.buyer_email,
                    "buyer_name": order.buyer_name,
                    "event_title": event.title,
                    "cancellation_reason": reason,
                    "order_ref": order.order_ref,
                    "refund_amount": face_value,
                    "is_free_order": False
                })
            else:
                order.status = "cancelled"
                order.updated_at = now
                db.add(order)

                for ticket in order.tickets:
                    ticket.status = "cancelled"
                    ticket.updated_at = now
                    db.add(ticket)

                cancelled_orders_count += 1
                notifications_to_send.append({
                    "to_email": order.buyer_email,
                    "buyer_name": order.buyer_name,
                    "event_title": event.title,
                    "cancellation_reason": reason,
                    "order_ref": order.order_ref,
                    "refund_amount": 0.0,
                    "is_free_order": True
                })

        db.commit()

        # 5. Dispatch cancellation & refund notification emails in background
        async def _dispatch_all_emails(items):
            for item in items:
                try:
                    await resend_email_service.send_event_cancellation_refund_notification(**item)
                except Exception as e:
                    logger.error(f"Failed to send cancellation email to {item.get('to_email')}: {e}")

        if notifications_to_send:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                loop.create_task(_dispatch_all_emails(notifications_to_send))
            else:
                def run_emails_thread():
                    asyncio.run(_dispatch_all_emails(notifications_to_send))
                t = threading.Thread(target=run_emails_thread, daemon=True)
                t.start()

        return {
            "success": True,
            "event_id": event.id,
            "is_cancelled": True,
            "refunded_orders": refunded_orders_count,
            "cancelled_orders": cancelled_orders_count,
            "total_orders_affected": refunded_orders_count + cancelled_orders_count
        }
    finally:
        if should_close:
            db.close()

