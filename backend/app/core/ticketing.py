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
