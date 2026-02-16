import os
import sys
import asyncio
import httpx
import logging
from sqlalchemy import create_engine, text, inspect
from typing import List, Dict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("cutover_images")

# Add backend directory to python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)

from app.core.config import settings
from app.services.cloudflare_service import upload_url_to_cloudflare, is_cloudflare_configured

# Semaphore to limit concurrent uploads to Cloudflare
MAX_CONCURRENT_UPLOADS = 5
semaphore = asyncio.Semaphore(MAX_CONCURRENT_UPLOADS)

async def migrate_row(client, engine, table, col, row_id, cloudinary_url):
    async with semaphore:
        try:
            logger.info(f"Migrating {table}.{col} (ID: {row_id}): {cloudinary_url}")
            # Upload to Cloudflare
            cloudflare_id = await upload_url_to_cloudflare(cloudinary_url, client=client)
            
            # Update DB with Raw ID
            update_query = text(f"UPDATE \"{table}\" SET \"{col}\" = :cf_id WHERE id = :r_id")
            with engine.begin() as conn:
                conn.execute(update_query, {"cf_id": cloudflare_id, "r_id": row_id})
            
            logger.info(f"SUCCESS: {table}.{col} (ID: {row_id}) -> {cloudflare_id}")
            return True
        except Exception as e:
            logger.error(f"FAILED: {table}.{col} (ID: {row_id}) | URL: {cloudinary_url} | Error: {e}")
            return False

async def cutover_images():
    if not is_cloudflare_configured():
        logger.error("Cloudflare Images not configured in environment variables. Skipping cutover.")
        return

    db_url = str(settings.DATABASE_URL).replace("postgres://", "postgresql://", 1)
    engine = create_engine(db_url, pool_pre_ping=True)
    inspector = inspect(engine)
    
    try:
        tables = inspector.get_table_names()
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        return
    
    logger.info("Starting production image cutover audit...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = []
        for table in tables:
            try:
                # Check columns
                with engine.connect() as conn:
                    res = conn.execute(text(f"SELECT * FROM \"{table}\" LIMIT 0"))
                    columns = res.keys()
                
                for col in columns:
                    # Target only columns likely to have images or matching our known targets
                    if not any(k in col.lower() for k in ["url", "image", "logo", "avatar", "hero", "path", "override"]):
                        continue

                    query = text(f"SELECT id, \"{col}\" FROM \"{table}\" WHERE CAST(\"{col}\" AS TEXT) LIKE '%res.cloudinary.com%'")
                    
                    with engine.connect() as conn:
                        rows = conn.execute(query).fetchall()
                    
                    if not rows:
                        continue
                        
                    logger.info(f"Found {len(rows)} Cloudinary URLs in {table}.{col}")
                    
                    for row in rows:
                        row_id, cloudinary_url = row
                        if cloudinary_url:
                            tasks.append(migrate_row(client, engine, table, col, row_id, cloudinary_url))
                            
            except Exception as e:
                logger.warning(f"Skipping table {table} due to inspection error: {e}")
                continue
        
        if tasks:
            logger.info(f"Processing {len(tasks)} total migration tasks...")
            results = await asyncio.gather(*tasks)
            success_count = sum(1 for r in results if r)
            logger.info(f"Cutover finished. Successful: {success_count}/{len(tasks)}")
        else:
            logger.info("No Cloudinary URLs found. Database is already clean.")

if __name__ == "__main__":
    try:
        asyncio.run(cutover_images())
    except KeyboardInterrupt:
        logger.info("Cutover interrupted by user.")
    except Exception as e:
        logger.critical(f"Unhandled exception in cutover script: {e}")
