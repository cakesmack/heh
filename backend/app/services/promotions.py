"""
Promotions service for managing venue promotions and discounts.
Handles promotion eligibility and unlocking.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from sqlmodel import Session, select

from app.models.promotion import Promotion



def get_active_promotions(
    session: Session,
    venue_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None
) -> list[Promotion]:
    """
    Get all active promotions, optionally filtered by venue.

    Args:
        session: Database session
        venue_id: Optional venue UUID to filter by
        user_id: Optional user UUID to check eligibility

    Returns:
        List of active promotions
    """
    query = select(Promotion).where(Promotion.active == True)

    # Filter expired promotions
    now = datetime.utcnow()
    query = query.where(
        (Promotion.expires_at == None) | (Promotion.expires_at > now)
    )

    # Filter by venue if provided
    if venue_id:
        query = query.where(Promotion.venue_id == venue_id)

    promotions = session.exec(query).all()
    # Logic for filtering by check-in eligibility has been removed
    return promotions


def is_promotion_unlocked(
    session: Session,
    promotion_id: UUID,
    user_id: UUID
) -> bool:
    """
    Check if a user has unlocked a specific promotion.

    Args:
        session: Database session
        promotion_id: Promotion UUID
        user_id: User UUID

    Returns:
        True if promotion is unlocked, False otherwise
    """
    promotion = session.get(Promotion, promotion_id)
    if not promotion:
        return False

    # Check if promotion is active and not expired
    if not promotion.active:
        return False

    if promotion.expires_at and promotion.expires_at < datetime.utcnow():
        return False

    # Logic for check-in requirement has been removed. All active promotions are unlocked.
    return True



