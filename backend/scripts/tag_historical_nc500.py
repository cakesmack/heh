"""
Historical NC500 Tagging Script
==============================
Iterates over all existing events in the database and applies the 
automated 'nc500' tagging logic based on location name or coordinates.

Usage:
    python -m scripts.tag_historical_nc500             # Dry-run
    python -m scripts.tag_historical_nc500 --apply      # Apply changes
"""
import argparse
import logging
import sys
import os

# Ensure the backend package is importable
app_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, app_root)

from sqlmodel import Session, select
from app.core.database import engine
from app.models.event import Event
from app.models.tag import Tag, EventTag

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

def tag_historical_events(session: Session, apply: bool = False):
    from app.api.events import apply_geographic_tagging, NC500_TOWNS, NC500_WAYPOINTS, haversine_distance
    
    logger.info("Starting historical NC500 tagging %s...", "(APPLY)" if apply else "(DRY RUN)")
    
    # Fetch all events (including non-published, but not archived/cancelled)
    events = session.exec(select(Event).where(Event.status != "archived")).all()
    logger.info(f"Checking {len(events)} events...")
    
    # Ensure nc500 tag exists for eligibility check
    nc500_tag = session.exec(select(Tag).where(Tag.name == "nc500")).first()
    
    tagged_count = 0
    
    for event in events:
        # Skip if already has nc500 tag
        has_tag = False
        if nc500_tag:
            existing = session.exec(
                select(EventTag).where(
                    EventTag.event_id == event.id,
                    EventTag.tag_id == nc500_tag.id
                )
            ).first()
            if existing:
                has_tag = True
        
        if has_tag:
            continue
            
        # Check eligibility manually for dry-run counts
        is_eligible = False
        
        # 1. Town match
        if event.location_name:
            loc_lower = event.location_name.lower()
            if any(town in loc_lower for town in NC500_TOWNS):
                is_eligible = True
                
        # 2. Coordinate match
        if not is_eligible and event.latitude is not None and event.longitude is not None:
            for w_lat, w_lon, w_name in NC500_WAYPOINTS:
                if haversine_distance(event.latitude, event.longitude, w_lat, w_lon) <= 25.0:
                    is_eligible = True
                    break
        
        if is_eligible:
            tagged_count += 1
            if apply:
                apply_geographic_tagging(session, event)
                logger.info(f"  [APPLY] Tagged: '{event.title}' ({event.location_name or 'coords'})")
            else:
                logger.info(f"  [DRY-RUN] Eligible: '{event.title}' ({event.location_name or 'coords'})")

    if apply:
        session.commit()
        logger.info(f"✅ Successfully tagged {tagged_count} historical events.")
    else:
        logger.info(f"🔍 Found {tagged_count} events eligible for NC500 tagging.")

def main():
    parser = argparse.ArgumentParser(description="Tag historical events with NC500 tag.")
    parser.add_argument("--apply", action="store_true", help="Apply changes to the database.")
    args = parser.parse_args()
    
    with Session(engine) as session:
        try:
            tag_historical_events(session, apply=args.apply)
        except Exception as e:
            session.rollback()
            logger.error(f"❌ Error during historical tagging: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main()
