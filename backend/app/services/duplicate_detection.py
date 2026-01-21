from datetime import timedelta
from difflib import SequenceMatcher
from sqlalchemy import func
from sqlmodel import Session, select
from app.models.event import Event
from app.services.geolocation import haversine_distance

def calculate_similarity(a: str, b: str) -> float:
    """Returns a ratio of similarity between 0 and 1."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def check_duplicate_risk(new_event: Event, session: Session):
    """
    Checks if the new_event has high risk of being a duplicate.
    Returns: (risk_score: int, metadata: dict)
    """
    # 1. Define time window (e.g. +/- 2 hours)
    if not new_event.date_start:
        return 0, {}
        
    start_window = new_event.date_start - timedelta(hours=2)
    end_window = new_event.date_start + timedelta(hours=2)
    
    # 2. Query candidates: Active events in the same time window
    query = (
        select(Event)
        .where(Event.date_start >= start_window)
        .where(Event.date_start <= end_window)
        .where(Event.status == "published") # Compare against published events
    )
    
    # Optimization: Filter by venue if possible
    if new_event.venue_id:
        # If venue is set, prioritize same venue
        query = query.where(Event.venue_id == new_event.venue_id)
    
    candidates = session.exec(query).all()
    
    highest_risk = 0
    match_metadata = {}
    
    for candidate in candidates:
        risk = 0
        reasons = []
        
        # Check Venue/Location Match
        location_match = False
        if new_event.venue_id and candidate.venue_id:
            if new_event.venue_id == candidate.venue_id:
                location_match = True
                risk += 50  # Up from 40
                reasons.append("Same Venue")
        elif new_event.latitude and candidate.latitude:
            dist = haversine_distance(
                new_event.latitude, new_event.longitude,
                candidate.latitude, candidate.longitude
            )
            if dist < 0.1: # 100 meters
                location_match = True
                risk += 40  # Up from 30
                reasons.append("Same Location (<100m)")
                
        # If locations are totally different (and venue is set), unlikely to be duplicate
        if not location_match and new_event.venue_id and candidate.venue_id:
            continue

        # Check Title Similarity
        similarity = calculate_similarity(new_event.title, candidate.title)
        if similarity > 0.85: # Threshold adjusted for "The Specials Ltd" vs "The Specials" (0.857)
            risk += 50
            reasons.append("Exact/Very Similar Title")
        elif similarity > 0.6: # Lowered from 0.7 for "Similar"
            risk += 30
            reasons.append("Similar Title")
            
        # Check Exact Time
        if new_event.date_start == candidate.date_start:
            risk += 20 # Up from 10
            reasons.append("Exact Start Time")
        
        # New Rule: Overlapping Time (if not exact match)
        # If same venue + overlapping time, highly suspicious
        elif location_match and (
            (new_event.date_start <= candidate.date_end) and 
            (new_event.date_end >= candidate.date_start)
        ):
             risk += 20
             reasons.append("Overlapping Time")
            
        # Cap risk at 100
        risk = min(risk, 100)
        
        if risk > highest_risk:
            highest_risk = risk
            match_metadata = {
                "matched_event_id": str(candidate.id),
                "matched_title": candidate.title,
                "risk_score": risk,
                "reasons": reasons
            }
            
    return highest_risk, match_metadata
