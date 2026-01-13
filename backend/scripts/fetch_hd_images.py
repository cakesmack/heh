
import json
import logging
import os
import sys
import time
from pathlib import Path
from sqlmodel import Session, select
import requests
from bs4 import BeautifulSoup
import cloudinary
import cloudinary.uploader
import random

# Ensure backend directory is in python path
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent
sys.path.append(str(backend_dir))

from app.core.database import engine
from app.models.event import Event


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Config
# Note: User says file is "c:\Users\Craig\Desktop\projects\antigrav\heh\eden_court_full_dump.json"
# So relative to backend/scripts (where this file is), it is ../../eden_court_full_dump.json
JSON_FILE = backend_dir.parent / "eden_court_full_dump.json"

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

    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True
    )
    return True

def fetch_hd_images():
    """
    Scrape HD images from event pages and update them in database.
    """
    if not JSON_FILE.exists():
        logger.error(f"JSON file not found at {JSON_FILE}")
        return

    logger.info(f"Loading source data from {JSON_FILE}...")
    try:
        with open(JSON_FILE, 'r', encoding='utf-8') as f:
            source_data = json.load(f)
    except Exception as e:
        logger.error(f"Failed to load JSON: {e}")
        return

    if not init_cloudinary():
        logger.error("Cloudinary not configured in environment variables.")
        return

    logger.info("Connecting to database...")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    with Session(engine) as session:
        total_items = len(source_data)
        logger.info(f"Processing {total_items} items from JSON...")

        updated_count = 0
        skipped_count = 0
        error_count = 0
        
        # Pre-fetch all events to minimize DB queries? 
        # Or Just query one by one to avoid stale data if script runs long?
        # Let's query one by one for simplicity and safety.

        for i, item in enumerate(source_data):
            progress = f"{i+1}/{total_items}"
            title = item.get('title')
            event_url = item.get('url')
            
            if not title:
                logger.warning(f"[{progress}] Skipped: No title in JSON item")
                continue
                
            # Find event in DB
            # Note: Titles might not match exactly if there were encoding differences, but user implies 1:1 match.
            # Using simple exact match for now.
            event = session.exec(select(Event).where(Event.title == title)).first()
            
            if not event:
                 # Try approximate match or skip? User said "match title".
                 # Optional: Log debug
                 # logger.debug(f"[{progress}] Skipped: Event '{title}' not found in DB")
                 skipped_count += 1
                 continue

            if not event_url:
                logger.warning(f"[{progress}] Skipped: Event '{title}' has no URL in JSON")
                skipped_count += 1
                continue

            logger.info(f"[{progress}] Processing: {title}")
            
            try:
                # Scrape Content
                logger.info(f"  Fetching: {event_url}")
                resp = requests.get(event_url, headers=headers, timeout=10)
                
                if resp.status_code != 200:
                    logger.warning(f"  Failed to fetch page: Status {resp.status_code}")
                    error_count += 1
                    continue

                soup = BeautifulSoup(resp.content, 'html.parser')
                
                # Find img with class 'o-image__full'
                img_tag = soup.find('img', class_='o-image__full')
                
                if not img_tag:
                    logger.warning("  No 'o-image__full' tag found on page.")
                    # Fallback? No, user specified this class specifically.
                    error_count += 1
                    continue
                
                # Extract SRC
                # Check 'src' or 'data-src' or 'srcset'
                # Usually standard img tag has src.
                high_res_url = img_tag.get('src')
                
                if not high_res_url:
                    logger.warning("  Image tag found but no 'src' attribute.")
                    error_count += 1
                    continue
                
                # Handle relative URLs if any (though usually Cloudfront/CDN are absolute)
                if high_res_url.startswith('/'):
                    # Eden Court domain
                    high_res_url = f"https://eden-court.co.uk{high_res_url}"
                
                logger.info(f"  Found HD Image: {high_res_url}")
                
                # Upload to Cloudinary
                # Crucial: NO transformations
                upload_start = time.time()
                upload_result = cloudinary.uploader.upload(
                    high_res_url,
                    folder="highland_events/events",
                    resource_type="image"
                )
                
                new_secure_url = upload_result.get("secure_url")
                
                if new_secure_url:
                    event.image_url = new_secure_url
                    session.add(event)
                    session.commit()
                    session.refresh(event)
                    
                    updated_count += 1
                    logger.info(f"  ✅ Upgraded '{title}' to HD")
                else:
                    logger.error("  Upload failed: No secure_url returned")
                    error_count += 1

                # Polite scraping delay
                time.sleep(random.uniform(0.5, 1.5))

            except Exception as e:
                logger.error(f"  Error: {str(e)}")
                error_count += 1

        logger.info("="*50)
        logger.info("HD Upgrade Complete")
        logger.info(f"Total Items: {total_items}")
        logger.info(f"Updated: {updated_count}")
        logger.info(f"Skipped: {skipped_count}")
        logger.info(f"Errors: {error_count}")
        logger.info("="*50)

if __name__ == "__main__":
    fetch_hd_images()
