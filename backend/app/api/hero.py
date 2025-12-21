"""
API endpoints for managing Hero Slots.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from app.core.database import get_session
from app.models.hero import HeroSlot
from app.models.event import Event
from app.models.venue import Venue
from app.schemas.hero import HeroSlotCreate, HeroSlotUpdate, HeroSlotResponse
from app.core.security import get_current_active_admin

router = APIRouter()

@router.get("/", response_model=List[HeroSlotResponse])
def get_hero_slots(
    active_only: bool = Query(False, description="Filter by active status"),
    session: Session = Depends(get_session)
):
    """
    Get all hero slots, ordered by position.
    """
    query = select(HeroSlot).options(selectinload(HeroSlot.event)).order_by(HeroSlot.position)
    if active_only:
        query = query.where(HeroSlot.is_active == True)
    
    slots = session.exec(query).all()
    
    # Convert to response models and populate venue_name
    responses = []
    for slot in slots:
        slot_response = HeroSlotResponse.from_orm(slot)
        if slot_response.event and slot.event and slot.event.venue_id:
            venue = session.get(Venue, slot.event.venue_id)
            if venue:
                slot_response.event.venue_name = venue.name
        responses.append(slot_response)
    
    return responses

@router.post("/", response_model=HeroSlotResponse)
def create_hero_slot(
    slot: HeroSlotCreate,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_active_admin)
):
    """
    Create a new hero slot.
    """
    # Check if position is taken
    existing = session.exec(select(HeroSlot).where(HeroSlot.position == slot.position)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Slot position {slot.position} is already taken")
    
    db_slot = HeroSlot.from_orm(slot)
    session.add(db_slot)
    session.commit()
    session.refresh(db_slot)
    
    # Reload with event relationship
    refreshed_slot = session.exec(
        select(HeroSlot).where(HeroSlot.id == db_slot.id).options(selectinload(HeroSlot.event))
    ).first()
    
    # Convert to response and populate venue_name
    slot_response = HeroSlotResponse.from_orm(refreshed_slot)
    if slot_response.event and refreshed_slot.event and refreshed_slot.event.venue_id:
        venue = session.get(Venue, refreshed_slot.event.venue_id)
        if venue:
            slot_response.event.venue_name = venue.name
    
    return slot_response

@router.put("/{slot_id}", response_model=HeroSlotResponse)
def update_hero_slot(
    slot_id: int,
    slot_update: HeroSlotUpdate,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_active_admin)
):
    """
    Update a hero slot.
    """
    db_slot = session.get(HeroSlot, slot_id)
    if not db_slot:
        raise HTTPException(status_code=404, detail="Hero slot not found")
    
    slot_data = slot_update.dict(exclude_unset=True)
    for key, value in slot_data.items():
        setattr(db_slot, key, value)
        
    session.add(db_slot)
    session.commit()
    session.refresh(db_slot)
    
    # Reload with event relationship
    refreshed_slot = session.exec(
        select(HeroSlot).where(HeroSlot.id == db_slot.id).options(selectinload(HeroSlot.event))
    ).first()
    
    # Convert to response and populate venue_name
    slot_response = HeroSlotResponse.from_orm(refreshed_slot)
    if slot_response.event and refreshed_slot.event and refreshed_slot.event.venue_id:
        venue = session.get(Venue, refreshed_slot.event.venue_id)
        if venue:
            slot_response.event.venue_name = venue.name
    
    return slot_response

@router.delete("/{slot_id}")
def delete_hero_slot(
    slot_id: int,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_active_admin)
):
    """
    Delete a hero slot.
    """
    db_slot = session.get(HeroSlot, slot_id)
    if not db_slot:
        raise HTTPException(status_code=404, detail="Hero slot not found")
        
    session.delete(db_slot)
    session.commit()
    return {"ok": True}
