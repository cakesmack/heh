"""
Promotions API routes.
Handles venue promotions and discount offers.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.utils import normalize_uuid
from app.models.user import User
from app.models.venue import Venue
from app.models.promotion import Promotion
from app.schemas.promotions import (
    PromotionCreate,
    PromotionUpdate,
    PromotionResponse,
    PromotionListResponse
)
from app.services.promotions import get_active_promotions, is_promotion_unlocked
from app.services.geolocation import haversine_distance

router = APIRouter(tags=["Promotions"])


@router.get("/promotions/active", response_model=PromotionListResponse)
def list_active_promotions(
    venue_id: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get active promotions, optionally filtered by venue or user eligibility.

    Returns promotions with unlock status for authenticated user.
    """
    venue_id_normalized = normalize_uuid(venue_id) if venue_id else None
    promotions = get_active_promotions(session, venue_id_normalized, current_user.id)

    # Build responses with computed fields
    promotion_responses = []
    for promo in promotions:
        venue = session.get(Venue, promo.venue_id)

        # Calculate distance if coordinates provided
        distance_km = None
        if latitude is not None and longitude is not None and venue:
            distance_km = haversine_distance(
                latitude, longitude, venue.latitude, venue.longitude
            )

        # Check if unlocked
        unlocked = is_promotion_unlocked(session, promo.id, current_user.id)

        promo_response = PromotionResponse.from_orm(promo)
        promo_response.venue_name = venue.name if venue else None
        promo_response.is_unlocked = unlocked
        promo_response.distance_km = distance_km

        promotion_responses.append(promo_response)

    return PromotionListResponse(
        promotions=promotion_responses,
        total=len(promotion_responses)
    )


@router.post("/venues/{venue_id}/promotions", response_model=PromotionResponse, status_code=status.HTTP_201_CREATED)
def create_promotion(
    venue_id: str,
    promo_data: PromotionCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Create a new promotion for a venue.

    Only venue owner or admin can create promotions.
    """
    # Get venue
    venue_id_normalized = normalize_uuid(venue_id)
    venue = session.get(Venue, venue_id_normalized)
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found"
        )

    # Check permissions
    if venue.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to create promotions for this venue"
        )

    # Create promotion
    new_promotion = Promotion(
        venue_id=venue_id_normalized,
        title=promo_data.title,
        description=promo_data.description,
        discount_type=promo_data.discount_type,
        discount_value=promo_data.discount_value,
        # Check-in requirement removed
        expires_at=promo_data.expires_at,
        active=promo_data.active
    )

    session.add(new_promotion)
    session.commit()
    session.refresh(new_promotion)

    # Build response
    promo_response = PromotionResponse.from_orm(new_promotion)
    promo_response.venue_name = venue.name

    return promo_response


@router.get("/promotions/{promotion_id}", response_model=PromotionResponse)
def get_promotion(
    promotion_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get a specific promotion by ID.
    """
    promotion_id_normalized = normalize_uuid(promotion_id)
    promotion = session.get(Promotion, promotion_id_normalized)
    if not promotion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Promotion not found"
        )

    venue = session.get(Venue, promotion.venue_id)
    unlocked = is_promotion_unlocked(session, promotion_id_normalized, current_user.id)

    promo_response = PromotionResponse.from_orm(promotion)
    promo_response.venue_name = venue.name if venue else None
    promo_response.is_unlocked = unlocked

    return promo_response


@router.put("/promotions/{promotion_id}", response_model=PromotionResponse)
def update_promotion(
    promotion_id: str,
    promo_data: PromotionUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Update an existing promotion.

    Only venue owner or admin can update.
    """
    promotion = session.get(Promotion, normalize_uuid(promotion_id))
    if not promotion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Promotion not found"
        )

    venue = session.get(Venue, promotion.venue_id)
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated venue not found"
        )

    # Check permissions
    if venue.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this promotion"
        )

    # Update fields
    update_data = promo_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(promotion, field, value)

    session.add(promotion)
    session.commit()
    session.refresh(promotion)

    # Build response
    promo_response = PromotionResponse.from_orm(promotion)
    promo_response.venue_name = venue.name

    return promo_response


@router.delete("/promotions/{promotion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_promotion(
    promotion_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Delete a promotion.

    Only venue owner or admin can delete.
    """
    promotion = session.get(Promotion, normalize_uuid(promotion_id))
    if not promotion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Promotion not found"
        )

    venue = session.get(Venue, promotion.venue_id)
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated venue not found"
        )

    # Check permissions
    if venue.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this promotion"
        )

    session.delete(promotion)
    session.commit()

    return None
