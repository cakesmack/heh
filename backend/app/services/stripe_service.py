from __future__ import annotations
import stripe
import json
import secrets
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union, Tuple
from sqlmodel import Session, select, or_
from app.core.config import settings
from app.models import OrganizerStripeAccount, User, Order, TicketTier, Ticket, PromoCode, Event

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

def fulfill_payment_intent(
    intent_or_id: Any,
    session: Session,
    stripe_account_id: Optional[str] = None
) -> Optional[Order]:
    """
    Fulfills an order from a successful Stripe payment intent.
    Idempotent: if the order already exists, returns it immediately.
    Supports both platform and connected account (Stripe Connect) contexts.
    Can be invoked by webhooks or as a direct polling fallback.
    """
    # 1. Idempotency check with local DB first
    pi_id = intent_or_id if isinstance(intent_or_id, str) else getattr(intent_or_id, "id", None)
    if pi_id:
        existing_order = session.exec(select(Order).where(Order.stripe_payment_intent_id == pi_id)).first()
        if existing_order:
            return existing_order

    if not settings.STRIPE_SECRET_KEY:
        return None
        
    stripe.api_key = settings.STRIPE_SECRET_KEY
    intent = None

    if isinstance(intent_or_id, str):
        # A. Try with provided connected account context if available
        if stripe_account_id:
            try:
                intent = stripe.PaymentIntent.retrieve(intent_or_id, stripe_account=stripe_account_id)
            except stripe.error.InvalidRequestError as e:
                logger.info(f"Intent {intent_or_id} not found on connected account {stripe_account_id}: {e}")
            except Exception as e:
                logger.warning(f"Error retrieving intent on connected account {stripe_account_id}: {e}")

        # B. Try platform account context
        if not intent:
            try:
                intent = stripe.PaymentIntent.retrieve(intent_or_id)
            except stripe.error.InvalidRequestError:
                pass
            except Exception as e:
                logger.warning(f"Error retrieving intent on platform account: {e}")

        # C. Try searching across active connected accounts in DB as fallback
        if not intent:
            try:
                active_accounts = session.exec(
                    select(OrganizerStripeAccount.stripe_account_id)
                    .where(OrganizerStripeAccount.charges_enabled == True)
                ).all()
                for acc_id in active_accounts:
                    if not acc_id or acc_id == stripe_account_id:
                        continue
                    try:
                        intent = stripe.PaymentIntent.retrieve(intent_or_id, stripe_account=acc_id)
                        if intent:
                            break
                    except stripe.error.InvalidRequestError:
                        continue
                    except Exception:
                        continue
            except Exception as e:
                logger.warning(f"Error searching connected accounts for intent {intent_or_id}: {e}")
    else:
        intent = intent_or_id

    if not intent:
        return None

    pi_id = getattr(intent, "id", None) or str(intent_or_id)
    pi_status = getattr(intent, "status", "")
    
    if pi_status != "succeeded":
        logger.info(f"PaymentIntent {pi_id} status is '{pi_status}', skipping fulfillment.")
        return None

    # Idempotency re-check
    existing_order = session.exec(select(Order).where(Order.stripe_payment_intent_id == pi_id)).first()
    if existing_order:
        return existing_order

    metadata = getattr(intent, "metadata", {}) or {}
    if hasattr(metadata, "to_dict"):
        metadata = metadata.to_dict()
    elif not isinstance(metadata, dict):
        try:
            metadata = dict(metadata)
        except Exception:
            metadata = {}

    event_id = metadata.get("event_id")
    if not event_id:
        logger.warning(f"PaymentIntent {pi_id} missing event_id in metadata.")
        return None

    try:
        raw_items = metadata.get("items_json", "[]")
        if isinstance(raw_items, list):
            items_payload = raw_items
        elif isinstance(raw_items, str):
            try:
                items_payload = json.loads(raw_items)
            except Exception:
                items_payload = []
        else:
            items_payload = []

        promo_code = metadata.get("promo_code")
        
        # 1. Lock and decrement inventory
        tier_ids = [item.get("tier_id") for item in items_payload if item.get("tier_id")]
        tiers = session.exec(select(TicketTier).where(TicketTier.id.in_(tier_ids)).with_for_update()).all()
        tier_map = {t.id: t for t in tiers}
        
        tier_items = []
        for item in items_payload:
            tier = tier_map.get(item["tier_id"])
            if not tier:
                continue
            qty = item.get("quantity", 1)
            tier.quantity_sold += qty
            session.add(tier)
            tier_items.append((tier, qty))
            
        # 2. Promo Code usage
        if promo_code:
            promo = session.exec(
                select(PromoCode).where(PromoCode.event_id == event_id, PromoCode.code_text == promo_code).with_for_update()
            ).first()
            if promo:
                promo.usage_count += 1
                session.add(promo)
                
        # 3. Generate Order Ref
        def generate_order_ref():
            return "HEH-" + secrets.token_hex(3).upper()
            
        order_ref = generate_order_ref()
        while session.exec(select(Order).where(Order.order_ref == order_ref)).first():
            order_ref = generate_order_ref()
            
        total_amount = float(getattr(intent, "amount", 0) or 0) / 100.0
        
        app_fee = getattr(intent, "application_fee_amount", None)
        if app_fee is not None and app_fee > 0:
            platform_fee_amount = float(app_fee) / 100.0
        else:
            platform_fee_amount = float(metadata.get("platform_fee_amount", 0) or 0)
        
        charges = getattr(intent, "charges", None)
        billing_details = None
        if charges and getattr(charges, "data", None) and len(charges.data) > 0:
            billing_details = getattr(charges.data[0], "billing_details", None)

        buyer_email = (
            metadata.get("buyer_email")
            or getattr(intent, "receipt_email", None)
            or (getattr(billing_details, "email", None) if billing_details else None)
            or ""
        )
        buyer_name = (
            metadata.get("buyer_name")
            or (getattr(billing_details, "name", None) if billing_details else None)
            or "Ticket Buyer"
        )
        buyer_phone = (
            metadata.get("buyer_phone")
            or (getattr(billing_details, "phone", None) if billing_details else None)
        )

        buyer_email_clean = buyer_email.strip().lower()
        buyer_user_id = metadata.get("buyer_user_id") or None
        if not buyer_user_id and buyer_email_clean:
            from sqlalchemy import func
            matching_user = session.exec(select(User).where(func.lower(User.email) == buyer_email_clean)).first()
            if matching_user:
                buyer_user_id = matching_user.id
        
        attendee_responses = {}
        raw_responses = metadata.get("attendee_responses")
        if raw_responses:
            if isinstance(raw_responses, dict):
                attendee_responses = raw_responses
            elif isinstance(raw_responses, str):
                try:
                    attendee_responses = json.loads(raw_responses)
                except Exception:
                    attendee_responses = {}

        order = Order(
            order_ref=order_ref,
            event_id=event_id,
            buyer_user_id=buyer_user_id,
            buyer_email=buyer_email,
            buyer_name=buyer_name,
            buyer_phone=buyer_phone,
            total_amount=total_amount,
            platform_fee_amount=platform_fee_amount,
            stripe_payment_intent_id=pi_id,
            status="completed",
            attendee_responses=attendee_responses
        )
        session.add(order)
        session.flush()
        
        # 4. Generate Tickets
        for tier, qty in tier_items:
            for _ in range(qty):
                ticket = Ticket(
                    order_id=order.id,
                    tier_id=tier.id,
                    qr_token=secrets.token_urlsafe(48),
                    status="valid"
                )
                session.add(ticket)
                
        session.commit()
        session.refresh(order)
        logger.info(f"FulfillPaymentIntent: Successfully created order {order_ref} for {pi_id}")

        return order
    except Exception as e:
        session.rollback()
        logger.error(f"FulfillPaymentIntent failed for {pi_id}: {e}")
        return None


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

