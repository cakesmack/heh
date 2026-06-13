import sys
import os
import json
import logging
from sqlalchemy import create_engine, text, inspect
from sqlmodel import Session, select, func

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("sync_tags")

# Add backend directory to python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_dir)

from app.core.config import settings
from app.models.tag import Tag, EventTag, normalize_tag_name

def sync_tags():
    logger.info("Connecting to database...")
    db_url = str(settings.DATABASE_URL).replace("postgres://", "postgresql://", 1)
    engine = create_engine(db_url)
    
    # 1. Schema Introspection Check
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('events')]
    if 'tags' not in columns:
        logger.warning("No 'tags' column found in the 'events' table. Local database matches the clean relational model.")
        logger.info("Data backfill is skipped because the flat tags column is not present.")
        return

    # 2. Migration Logic
    logger.info("Fetching events with flat tags...")
    with Session(engine) as session:
        # Retrieve all events with tags (using raw text since the column is not in SQLModel)
        result = session.execute(text("SELECT id, tags FROM events WHERE tags IS NOT NULL"))
        events_data = result.fetchall()
        logger.info(f"Found {len(events_data)} events with tag data to process.")
        
        tags_created = 0
        relations_created = 0
        
        for event_id, raw_tags in events_data:
            if not raw_tags:
                continue
                
            # Parse raw tags depending on format (JSON array, Postgres array, or string)
            parsed_tags = []
            if isinstance(raw_tags, list):
                parsed_tags = raw_tags
            elif isinstance(raw_tags, str):
                trimmed = raw_tags.strip()
                if trimmed.startswith("[") and trimmed.endswith("]"):
                    try:
                        parsed_tags = json.loads(trimmed)
                    except json.JSONDecodeError:
                        parsed_tags = [t.strip() for t in trimmed[1:-1].split(",") if t.strip()]
                elif trimmed.startswith("{") and trimmed.endswith("}"):
                    # Postgres array format
                    parsed_tags = [t.strip() for t in trimmed[1:-1].split(",") if t.strip()]
                else:
                    # Comma separated string
                    parsed_tags = [t.strip() for t in trimmed.split(",") if t.strip()]
            
            for raw_tag in parsed_tags:
                normalized = normalize_tag_name(raw_tag)
                if not normalized:
                    continue
                
                # Check if tag exists
                tag = session.exec(select(Tag).where(Tag.name == normalized)).first()
                if not tag:
                    tag = Tag(name=normalized)
                    session.add(tag)
                    session.flush()
                    tags_created += 1
                    logger.info(f"Created new tag: '{normalized}'")
                
                # Check if relationship exists in event_tags
                existing_rel = session.exec(
                    select(EventTag).where(
                        EventTag.event_id == event_id,
                        EventTag.tag_id == tag.id
                    )
                ).first()
                
                if not existing_rel:
                    rel = EventTag(event_id=event_id, tag_id=tag.id)
                    session.add(rel)
                    relations_created += 1
                    logger.debug(f"Linked tag '{normalized}' to event '{event_id}'")
            
            session.commit()
            
        logger.info(f"Migration complete: {tags_created} new tags created, {relations_created} new event-tag relations linked.")

        # 3. Usage Count Recalculation
        logger.info("Recalculating tag usage counts...")
        # Get count of relationships per tag_id
        usage_counts = session.execute(
            text("SELECT tag_id, COUNT(event_id) FROM event_tags GROUP BY tag_id")
        ).fetchall()
        
        updated_counts = 0
        for tag_id, count in usage_counts:
            tag = session.get(Tag, tag_id)
            if tag:
                if tag.usage_count != count:
                    tag.usage_count = count
                    session.add(tag)
                    updated_counts += 1
                    
        session.commit()
        logger.info(f"Usage counts updated for {updated_counts} tags.")

if __name__ == "__main__":
    sync_tags()
