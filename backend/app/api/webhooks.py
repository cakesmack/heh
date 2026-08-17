from __future__ import annotations
from typing import Any, Dict, List, Optional, Union, Tuple
import stripe
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlmodel import Session
import logging

from app.core.config import settings
from app.core.database import get_session
from app.models import Order, TicketTier, Ticket, PromoCode, Event
from app.services import stripe_service
import json
import secrets

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/stripe-connect")
async def stripe_connect_webhook(
    request: Request,
    session: Session = Depends(get_session)
):
    """
    Webhook receiver for Stripe Connect events.
    Verifies the Stripe signature and processes account updates.
    """
    if not settings.STRIPE_CONNECT_WEBHOOK_SECRET:
        logger.error("STRIPE_CONNECT_WEBHOOK_SECRET is not configured.")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_CONNECT_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error(f"Invalid payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    if event.type == "account.updated":
        account = event.data.object
        account_id = account.id
        
        logger.info(f"Processing account.updated for Stripe Account: {account_id}")
        
        try:
            stripe_service.sync_account_status(account_id, session)
        except ValueError as e:
            # If the account isn't in our DB, we log and ignore (might be from another environment)
            logger.warning(f"Failed to sync account status: {e}")
            pass
        except Exception as e:
            logger.error(f"Error syncing account status: {e}")
            # We return 200 to Stripe anyway if it's an internal error we can't fix via retry,
            # or we could return 500 to let Stripe retry. Let's return 500 to allow retries.
            raise HTTPException(status_code=500, detail="Internal server error syncing account")
            
    elif event.type == "payment_intent.succeeded":
        intent = event.data.object
        pi_id = getattr(intent, "id", "")
        logger.info(f"Processing payment_intent.succeeded for {pi_id}")
        order = stripe_service.fulfill_payment_intent(intent, session)
        if not order:
            logger.warning(f"Could not fulfill payment intent {pi_id} (may not be a ticket order or failed transaction).")
        return {"status": "success"}

    else:
        logger.info(f"Unhandled Stripe Connect event type: {event.type}")

    return {"status": "success"}
