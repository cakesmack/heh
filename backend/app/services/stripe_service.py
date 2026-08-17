import stripe
import json
import secrets
import logging
from typing import Any, Optional
from sqlmodel import Session, select
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
    event_id = metadata.get("event_id")
    if not event_id:
        logger.warning(f"PaymentIntent {pi_id} missing event_id in metadata.")
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
            
        total_amount = float(getattr(intent, "amount", 0)) / 100.0
        platform_fee_amount = float(getattr(intent, "application_fee_amount", 0) or 0) / 100.0
        
        buyer_email_clean = (metadata.get("buyer_email", "")).strip().lower()
        buyer_user_id = metadata.get("buyer_user_id") or None
        if not buyer_user_id and buyer_email_clean:
            from sqlalchemy import func
            matching_user = session.exec(select(User).where(func.lower(User.email) == buyer_email_clean)).first()
            if matching_user:
                buyer_user_id = matching_user.id
        
        order = Order(
            order_ref=order_ref,
            event_id=event_id,
            buyer_user_id=buyer_user_id,
            buyer_email=metadata.get("buyer_email", ""),
            buyer_name=metadata.get("buyer_name", ""),
            buyer_phone=metadata.get("buyer_phone", None),
            total_amount=total_amount,
            platform_fee_amount=platform_fee_amount,
            stripe_payment_intent_id=pi_id,
            status="completed",
            attendee_responses=json.loads(metadata.get("attendee_responses", "{}"))
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
        
        # 5. Dispatch confirmation email in background
        try:
            from app.models.event import Event
            from app.services.resend_email import resend_email_service
            import asyncio
            
            event = session.get(Event, event_id)
            event_title = event.title if event else "Highland Event"
            event_date_str = event.date_start.strftime("%A, %d %B %Y at %H:%M") if event and event.date_start else ""
            
            venue_info = ""
            if event:
                if event.venue:
                    venue_info = f"{event.venue.name}, {getattr(event.venue, 'address', '')}".strip(", ")
                elif event.location_name:
                    venue_info = f"{event.location_name}, {getattr(event, 'location_town', '') or ''}".strip(", ")
                    
            ticket_summary = [
                {"name": tier.name, "qty": qty, "price": tier.price}
                for tier, qty in tier_items
            ]
            
            # Create in-app notification for event organizer
            try:
                if event and event.organizer_id:
                    from app.models.notification import Notification, NotificationType
                    n_type = getattr(NotificationType, "TICKET_PURCHASED", NotificationType.SYSTEM)
                    total_tickets = sum(qty for _, qty in tier_items)
                    tiers_label = ", ".join(f"{qty}x {tier.name}" for tier, qty in tier_items)
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

            # Fire & forget email tasks
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # 1. Buyer confirmation email
                    loop.create_task(
                        resend_email_service.send_ticket_order_confirmation(
                            to_email=order.buyer_email,
                            order_ref=order.order_ref,
                            event_title=event_title,
                            event_date_str=event_date_str,
                            venue_info=venue_info,
                            buyer_name=order.buyer_name,
                            total_amount=order.total_amount,
                            ticket_summary=ticket_summary
                        )
                    )

                    # 2. Organizer sale notification email
                    organizer_user = session.get(User, event.organizer_id) if event and event.organizer_id else None
                    organizer_email = organizer_user.email if organizer_user else None
                    if not organizer_email and event and event.organizer_profile:
                        organizer_email = event.organizer_profile.contact_email
                    
                    if organizer_email:
                        organizer_name = organizer_user.username if organizer_user else "Organizer"
                        loop.create_task(
                            resend_email_service.send_organizer_ticket_sale_notification(
                                organizer_email=organizer_email,
                                organizer_name=organizer_name,
                                event_title=event_title,
                                event_id=event.id,
                                order_ref=order.order_ref,
                                buyer_name=order.buyer_name,
                                buyer_email=order.buyer_email,
                                tickets_breakdown=ticket_summary,
                                total_amount=order.total_amount,
                                platform_fee=order.platform_fee_amount,
                                net_amount=order.total_amount - order.platform_fee_amount
                            )
                        )
            except Exception as task_err:
                logger.warning(f"Could not queue async email task: {task_err}")
        except Exception as email_err:
            logger.warning(f"Failed to prepare ticket confirmation email: {email_err}")

        return order
    except Exception as e:
        session.rollback()
        logger.error(f"FulfillPaymentIntent failed for {pi_id}: {e}")
        return None
