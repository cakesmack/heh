from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional, Union, Tuple
import stripe
from fastapi import APIRouter, Request, HTTPException, Depends, Header
from sqlmodel import Session

from app.core.config import settings
from app.core.database import get_session
from app.services import stripe_service
from app.services.featured import handle_checkout_completed, handle_checkout_expired

router = APIRouter()
logger = logging.getLogger(__name__)


# ============================================================
# STANDARD PLATFORM STRIPE WEBHOOK (e.g. Promoted Events / Featured Ads)
# ============================================================

@router.post("/stripe")
@router.post("/stripe/")
async def standard_stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature"),
    session: Session = Depends(get_session)
):
    """
    Webhook endpoint for standard platform Stripe events (e.g., promoted event bookings).
    Uses STRIPE_WEBHOOK_SECRET for signature verification.
    """
    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.error("STRIPE_WEBHOOK_SECRET is not configured.")
        raise HTTPException(status_code=500, detail="Standard Stripe webhook secret not configured")

    payload = await request.body()
    sig_header = stripe_signature or request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error(f"[Standard Webhook] Invalid payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"[Standard Webhook] Invalid signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    logger.info(f"[Standard Webhook] Received event: {event.type}")

    try:
        if event.type == "checkout.session.completed":
            session_data = event.data.object
            logger.info("[Standard Webhook] Processing checkout.session.completed for featured/platform booking")
            handle_checkout_completed(session, session_data)
        elif event.type == "checkout.session.expired":
            session_data = event.data.object
            logger.info("[Standard Webhook] Processing checkout.session.expired")
            handle_checkout_expired(session, session_data)
        else:
            logger.info(f"[Standard Webhook] Unhandled event type: {event.type}")
    except Exception as e:
        logger.error(f"[Standard Webhook] Error processing event {event.type}: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}

    return {"status": "success"}


# ============================================================
# STRIPE CONNECT WEBHOOK (Ticket Sales & Connected Accounts)
# ============================================================

@router.post("/stripe-connect")
@router.post("/stripe-connect/")
async def stripe_connect_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature"),
    session: Session = Depends(get_session)
):
    """
    Webhook receiver for Stripe Connect events (connected organizer accounts).
    Verifies the signature using STRIPE_CONNECT_WEBHOOK_SECRET.
    Catches checkout.session.completed and payment_intent.succeeded for ticket fulfillment,
    and account.updated for Stripe onboarding sync.
    """
    if not settings.STRIPE_CONNECT_WEBHOOK_SECRET:
        logger.error("STRIPE_CONNECT_WEBHOOK_SECRET is not configured.")
        raise HTTPException(status_code=500, detail="Stripe Connect webhook secret not configured")

    payload = await request.body()
    sig_header = stripe_signature or request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_CONNECT_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error(f"[Connect Webhook] Invalid payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"[Connect Webhook] Invalid signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    logger.info(f"[Connect Webhook] Received event: {event.type}")

    try:
        if event.type == "payment_intent.succeeded":
            intent = event.data.object
            pi_id = getattr(intent, "id", "")
            logger.info(f"[Connect Webhook] Processing payment_intent.succeeded for intent: {pi_id}")
            order = stripe_service.fulfill_payment_intent(intent, session)
            if order:
                logger.info(f"[Connect Webhook] Successfully fulfilled ticket order: {order.order_ref} (PaymentIntent: {pi_id})")
                try:
                    await stripe_service.dispatch_order_confirmation_emails(order, session)
                except Exception as email_err:
                    logger.error(f"[Connect Webhook] Failed to dispatch order confirmation emails: {email_err}", exc_info=True)
            else:
                logger.warning(f"[Connect Webhook] Could not fulfill payment intent {pi_id}")
            return {"status": "success"}

        elif event.type == "account.updated":
            account = event.data.object
            account_id = getattr(account, "id", "")
            logger.info(f"[Connect Webhook] Processing account.updated for Stripe Account: {account_id}")
            try:
                stripe_service.sync_account_status(account_id, session)
            except ValueError as e:
                logger.warning(f"[Connect Webhook] Unlinked account sync skipped: {e}")
            except Exception as e:
                logger.error(f"[Connect Webhook] Error syncing account status: {e}")
                raise HTTPException(status_code=500, detail="Internal server error syncing account")
            return {"status": "success"}

        else:
            logger.info(f"[Connect Webhook] Unhandled Connect event type: {event.type}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Connect Webhook] Error handling event {event.type}: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}

    return {"status": "success"}
