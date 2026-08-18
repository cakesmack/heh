from __future__ import annotations
import stripe
import json
import secrets
import logging
from typing import Any, Dict, List, Optional, Union, Tuple
from sqlmodel import Session, select, or_
from app.core.config import settings
from app.models import OrganizerStripeAccount, User, Order, TicketTier, Ticket, PromoCode

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
    db_account.charges_enabled = stripe_account.charges_enabled
    db_account.payouts_enabled = stripe_account.payouts_enabled
    
    session.add(db_account)
    
    # If charges are enabled, ensure the user is fully approved if they were pending
    if stripe_account.charges_enabled:
        organizer = db_account.organizer
        if organizer and organizer.user:
            user = organizer.user
            if user.seller_tier == 2 and user.seller_status == "approved":
                pass
            else:
                user.seller_tier = 2
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


def fulfill_checkout_session(session_or_id: Any, session: Session) -> Optional[Order]:
    """
    Fulfills a completed Stripe Checkout session (checkout.session.completed) on a connected account.
    Extracts ticket/order details from the session metadata, locks inventory, creates order and tickets,
    and dispatches buyer/organizer confirmation emails.
    """
    if isinstance(session_or_id, str):
        if not settings.STRIPE_SECRET_KEY:
            return None
        stripe.api_key = settings.STRIPE_SECRET_KEY
        try:
            checkout_session = stripe.checkout.Session.retrieve(session_or_id)
        except Exception as e:
            logger.error(f"Error retrieving Checkout session {session_or_id}: {e}")
            return None
    else:
        checkout_session = session_or_id

    if not checkout_session:
        return None

    cs_id = getattr(checkout_session, "id", "")
    payment_intent_id = getattr(checkout_session, "payment_intent", None) or cs_id
    payment_status = getattr(checkout_session, "payment_status", "")

    if payment_status != "paid":
        logger.info(f"CheckoutSession {cs_id} payment_status is '{payment_status}', skipping fulfillment.")
        return None

    # Idempotency check: check if order already exists by payment_intent_id or session id
    existing_order = session.exec(
        select(Order).where(
            or_(
                Order.stripe_payment_intent_id == payment_intent_id,
                Order.stripe_payment_intent_id == cs_id
            )
        )
    ).first()
    if existing_order:
        logger.info(f"CheckoutSession {cs_id} already fulfilled (order {existing_order.order_ref}).")
        return existing_order

    metadata = getattr(checkout_session, "metadata", {}) or {}
    if hasattr(metadata, "to_dict"):
        metadata = metadata.to_dict()
    elif not isinstance(metadata, dict):
        try:
            metadata = dict(metadata)
        except Exception:
            metadata = {}

    event_id = metadata.get("event_id")
    if not event_id:
        logger.warning(f"CheckoutSession {cs_id} missing event_id in metadata.")
        return None

    try:
        items_payload = json.loads(metadata.get("items_json", "[]"))
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

        total_amount = float(getattr(checkout_session, "amount_total", 0) or 0) / 100.0
        platform_fee_amount = float(metadata.get("platform_fee_amount", 0) or 0)

        customer_details = getattr(checkout_session, "customer_details", None)
        buyer_email = metadata.get("buyer_email") or (getattr(customer_details, "email", None) if customer_details else "") or ""
        buyer_name = metadata.get("buyer_name") or (getattr(customer_details, "name", None) if customer_details else "") or "Ticket Buyer"
        buyer_phone = metadata.get("buyer_phone") or (getattr(customer_details, "phone", None) if customer_details else None)

        buyer_email_clean = buyer_email.strip().lower()
        buyer_user_id = metadata.get("buyer_user_id") or None
        if not buyer_user_id and buyer_email_clean:
            from sqlalchemy import func
            matching_user = session.exec(select(User).where(func.lower(User.email) == buyer_email_clean)).first()
            if matching_user:
                buyer_user_id = matching_user.id

        attendee_responses = {}
        if metadata.get("attendee_responses"):
            try:
                attendee_responses = json.loads(metadata.get("attendee_responses"))
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
            stripe_payment_intent_id=payment_intent_id or cs_id,
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
        logger.info(f"FulfillCheckoutSession: Successfully created order {order_ref} for {cs_id}")

        return order
    except Exception as e:
        session.rollback()
        logger.error(f"FulfillCheckoutSession failed for {cs_id}: {e}")
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
            if event and event.organizer_id and session:
                from app.models.notification import Notification, NotificationType
                n_type = getattr(NotificationType, "TICKET_PURCHASED", NotificationType.SYSTEM)
                total_tickets = sum(item["qty"] for item in ticket_summary)
                tiers_label = ", ".join(f"{item['qty']}x {item['name']}" for item in ticket_summary)
                organizer_notif = Notification(
                    user_id=event.organizer_id,
                    type=n_type,
                    title=f"🎟️ New Ticket Sale: {event.title}",
                    message=f"{order.buyer_name} purchased {total_tickets} ticket(s) ({tiers_label}) for £{order.total_amount:.2f} ({order.order_ref}).",
                    link=f"/organizers/events/{event.id}/ticketing"
                )
                session.add(organizer_notif)
                session.commit()
        except Exception as notif_err:
            logger.warning(f"Could not create in-app notification for organizer: {notif_err}")

        # 3. Email notification to organizer
        if organizer_email:
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
