"""
Promotions service for managing venue promotions and discounts.
Handles promotion eligibility and unlocking.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from sqlmodel import Session, select

from app.models.promotion import Promotion
from app.models.checkin import CheckIn


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

    # If user_id provided, filter by eligibility (has checked in)
    if user_id:
        eligible_promotions = []
        for promo in promotions:
            if not promo.requires_checkin:
                eligible_promotions.append(promo)
            else:
                # Check if user has checked in at this venue
                has_checkin = session.exec(
                    select(CheckIn)
                    .join(CheckIn.event)
                    .where(CheckIn.user_id == user_id)
                    .where(CheckIn.event.has(venue_id=promo.venue_id))
                ).first()

                if has_checkin:
                    eligible_promotions.append(promo)

        return eligible_promotions

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

    # If no check-in required, it's automatically unlocked
    if not promotion.requires_checkin:
        return True

    # Check if user has checked in at this venue
    has_checkin = session.exec(
        select(CheckIn)
        .join(CheckIn.event)
        .where(CheckIn.user_id == user_id)
        .where(CheckIn.event.has(venue_id=promotion.venue_id))
    ).first()

    return has_checkin is not None


def get_promotion_for_venue_checkin(
    session: Session,
    venue_id: UUID,
    user_id: UUID
) -> Optional[Promotion]:
    """
    Get the first active promotion for a venue that gets unlocked upon check-in.

    Args:
        session: Database session
        venue_id: Venue UUID
        user_id: User UUID

    Returns:
        Promotion object if available, None otherwise
    """
    now = datetime.utcnow()

    promotion = session.exec(
        select(Promotion)
        .where(Promotion.venue_id == venue_id)
        .where(Promotion.active == True)
        .where(Promotion.requires_checkin == True)
        .where((Promotion.expires_at == None) | (Promotion.expires_at > now))
    ).first()

    return promotion
