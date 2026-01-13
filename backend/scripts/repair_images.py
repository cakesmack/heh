
import json
import logging
import os
import sys
from pathlib import Path
from sqlmodel import Session, select

# Ensure backend directory is in python path
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent
sys.path.append(str(backend_dir))

from app.core.database import engine
from app.models.event import Event
import cloudinary.uploader

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Config
JSON_FILE = "eden_court_standardized.json"

def is_cloudinary_configured() -> bool:
    """Check if Cloudinary is configured via Env vars."""
    return all([
        os.getenv("CLOUDINARY_CLOUD_NAME"),
        os.getenv("CLOUDINARY_API_KEY"),
        os.getenv("CLOUDINARY_API_SECRET")
    ])

def init_cloudinary():
    """Initialize Cloudinary configuration."""
    if not is_cloudinary_configured():
        return False

    import cloudinary
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True
    )
    return True

def repair_images():
    """
    Repair event images by replacing low-res versions with high-res originals from JSON.
    """
    json_path = current_dir / JSON_FILE
    
    if not json_path.exists():
        logger.error(f"JSON file not found at {json_path}")
        return

    logger.info(f"Loading source data from {json_path}...")
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            source_data = json.load(f)
    except Exception as e:
        logger.error(f"Failed to load JSON: {e}")
        return

    if not init_cloudinary():
        logger.error("Cloudinary not configured in environment variables.")
        return

    logger.info("Connecting to database...")
    
    with Session(engine) as session:
        # Build lookup map from JSON: title -> high_res_url
        # Assuming JSON structure is list of dicts with 'title' and 'image_url'
        title_to_url = {}
        for item in source_data:
            if item.get('title') and item.get('image_url'):
                title_to_url[item['title']] = item['image_url']
        
        logger.info(f"Loaded {len(title_to_url)} unique titles from JSON source.")

        # Fetch all events
        events = session.exec(select(Event)).all()
        total_events = len(events)
        logger.info(f"Scanning {total_events} events in database...")

        updated_count = 0
        skipped_count = 0
        error_count = 0

        for i, event in enumerate(events):
            progress = f"{i+1}/{total_events}"
            
            if event.title in title_to_url:
                high_res_url = title_to_url[event.title]
                
                # Skip if already updated (optional check? assuming we want to force update if blurry)
                # But if we just uploaded it, it will be a cloudinary URL. 
                # The user says "re-download and replace... low resolution". 
                # If the current image is already the high res one, we might waste bandwidth.
                # However, comparing URLs is hard. Let's just do it as requested.
                
                logger.info(f"[{progress}] Found match for '{event.title}'. Uploading high-res...")
                
                try:
                    # Upload to Cloudinary - NO transformations, keep original
                    upload_result = cloudinary.uploader.upload(
                        high_res_url,
                        folder="highland_events/events",
                        resource_type="image"
                        # No transformations!
                    )
                    
                    new_secure_url = upload_result.get("secure_url")
                    
                    if new_secure_url:
                        event.image_url = new_secure_url
                        session.add(event)
                        updated_count += 1
                        logger.info(f"[{progress}] Fixed: {event.title}")
                    else:
                        logger.error(f"[{progress}] Upload failed (no url returned): {event.title}")
                        error_count += 1

                except Exception as e:
                    logger.error(f"[{progress}] Error processing '{event.title}': {str(e)}")
                    error_count += 1
            else:
                skipped_count += 1
                # Optional: logger.debug(f"[{progress}] No match for '{event.title}'")

            # Commit periodically or at end? Doing at end is safer but slower. 
            # Doing in chunks is better. Let's commit every 10 updates.
            if updated_count > 0 and updated_count % 10 == 0:
                session.commit()

        # Final commit
        session.commit()
        
        logger.info("="*50)
        logger.info("Repair Complete")
        logger.info(f"Total Processed: {total_events}")
        logger.info(f"Updated: {updated_count}")
        logger.info(f"Skipped (No match): {skipped_count}")
        logger.info(f"Errors: {error_count}")
        logger.info("="*50)

if __name__ == "__main__":
    repair_images()
