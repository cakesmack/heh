"""
NC500 Geofencing Cleanup Script
==============================
Re-evaluates events tagged with 'nc500' against the new, tighter 10km radius criteria.
Removes the 'nc500' tag association if the event no longer qualifies.

Usage:
    python -m scripts.cleanup_incorrect_nc500             # Dry-run
    python -m scripts.cleanup_incorrect_nc500 --apply      # Apply changes
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

def cleanup_nc500_tags(session: Session, apply: bool = False):
    from app.api.events import NC500_TOWNS, NC500_WAYPOINTS, haversine_distance
    
    logger.info("Starting NC500 geofencing cleanup %s...", "(APPLY)" if apply else "(DRY RUN)")
    
    # Get the nc500 tag
    nc500_tag = session.exec(select(Tag).where(Tag.name == "nc500")).first()
    if not nc500_tag:
        logger.info("Tag 'nc500' not found. Nothing to clean.")
        return

    # Find all events with the nc500 tag
    stmt = select(Event).join(EventTag).where(EventTag.tag_id == nc500_tag.id)
    events = session.exec(stmt).all()
    
    logger.info(f"Checking {len(events)} events currently tagged with 'nc500'...")
    
    removed_count = 0
    kept_count = 0
    
    for event in events:
        is_eligible = False
        
        # 1. Town match (Fuzzy)
        if event.location_name:
            loc_lower = event.location_name.lower()
            if any(town in loc_lower for town in NC500_TOWNS):
                is_eligible = True
                
        # 2. Coordinate match (TIGHT 10km Radius)
        if not is_eligible and event.latitude is not None and event.longitude is not None:
            for w_lat, w_lon, w_name in NC500_WAYPOINTS:
                if haversine_distance(event.latitude, event.longitude, w_lat, w_lon) <= 10.0:
                    is_eligible = True
                    break
        
        if not is_eligible:
            removed_count += 1
            if apply:
                # Remove association
                assoc = session.exec(
                    select(EventTag).where(
                        EventTag.event_id == event.id,
                        EventTag.tag_id == nc500_tag.id
                    )
                ).first()
                if assoc:
                    session.delete(assoc)
                    if nc500_tag.usage_count > 0:
                        nc500_tag.usage_count -= 1
                logger.info(f"  [APPLY] Removing tag from: '{event.title}' ({event.location_name or 'coords'})")
            else:
                logger.info(f"  [DRY-RUN] Would remove tag from: '{event.title}' ({event.location_name or 'coords'})")
        else:
            kept_count += 1

    if apply:
        session.commit()
        logger.info(f"✅ Successfully removed 'nc500' tag from {removed_count} events. {kept_count} events remain tagged.")
    else:
        logger.info(f"🔍 Found {removed_count} events that no longer qualify. {kept_count} events would remain tagged.")

def main():
    parser = argparse.ArgumentParser(description="Cleanup incorrect NC500 tags.")
    parser.add_argument("--apply", action="store_true", help="Apply changes to the database.")
    args = parser.parse_args()
    
    with Session(engine) as session:
        try:
            cleanup_nc500_tags(session, apply=args.apply)
        except Exception as e:
            session.rollback()
            logger.error(f"❌ Error during cleanup: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main()
