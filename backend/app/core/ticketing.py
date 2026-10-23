"""Shared native-ticket sales containment guard."""

from fastapi import HTTPException, status

from app.core.config import settings


NATIVE_TICKET_SALES_DISABLED_DETAIL = (
    "Native ticket purchases are temporarily unavailable while checkout "
    "safety maintenance is completed. No payment has been initiated."
)

NATIVE_TICKET_SETUP_DISABLED_DETAIL = (
    "Native ticket setup is temporarily unavailable while checkout safety "
    "maintenance is completed. Create the event without native ticketing or "
    "use an external ticket URL."
)


def require_native_ticket_sales_enabled(*, setup: bool = False) -> None:
    """Reject new native-ticket commitments while preserving fulfilment paths."""
    if settings.NATIVE_TICKET_SALES_ENABLED:
        return

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            NATIVE_TICKET_SETUP_DISABLED_DETAIL
            if setup
            else NATIVE_TICKET_SALES_DISABLED_DETAIL
        ),
    )


def require_paid_ticket_account(session, organizer_profile_id, organizer_id):
    """Reuse checkout's existing Connect account resolution, for paid tickets only."""
    from sqlmodel import select
    from app.models.organizer import Organizer
    from app.models.organizer_stripe_account import OrganizerStripeAccount

    account = session.exec(select(OrganizerStripeAccount).where(
        OrganizerStripeAccount.organizer_profile_id == organizer_profile_id,
        OrganizerStripeAccount.charges_enabled == True,
    )).first() if organizer_profile_id else None
    if not account and organizer_id:
        account = session.exec(select(OrganizerStripeAccount)
            .join(Organizer, OrganizerStripeAccount.organizer_profile_id == Organizer.id)
            .where(Organizer.user_id == organizer_id, OrganizerStripeAccount.charges_enabled == True)).first()
    if not account or not account.stripe_account_id:
        raise HTTPException(400, "Organizer is not ready to accept payments. Connect Stripe before configuring paid tickets.")
    return account


def require_stripe_for_paid_tiers(session, tiers, organizer_profile_id, organizer_id):
    if any(tier.price > 0 for tier in tiers):
        require_paid_ticket_account(session, organizer_profile_id, organizer_id)
