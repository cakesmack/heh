import os
import sys
import json
import logging
from sqlalchemy import create_engine, text, inspect
from typing import Dict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("sync_live_db")

# Add backend directory to python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)

from app.core.config import settings

def sync_live_db(mapping_file="db_cf_mapping.json"):
    # Load mapping
    if not os.path.exists(mapping_file):
        # check if it's in the same dir as the script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        mapping_file = os.path.join(script_dir, "db_cf_mapping.json")
        
        if not os.path.exists(mapping_file):
            # check if it's in the backend root
            mapping_file = os.path.join(backend_dir, "db_cf_mapping.json")
            
    if not os.path.exists(mapping_file):
        logger.error(f"Mapping file not found: {mapping_file}")
        return

    logger.info(f"Loading mapping from {mapping_file}...")
    with open(mapping_file, 'r') as f:
        mapping = json.load(f)

    # Connect to DB
    logger.info("Connecting to database...")
    db_url = str(settings.DATABASE_URL).replace("postgres://", "postgresql://", 1)
    engine = create_engine(db_url)
    
    total_updates = 0
    with engine.begin() as conn:
        for table, rows in mapping.items():
            logger.info(f"Syncing table: {table}")
            table_updates = 0
            
            for row_id, updates in rows.items():
                for col, cf_id in updates.items():
                    # Check if update is needed (optional, but good for logging)
                    # We'll just do a direct update for speed and simplicity
                    query = text(f"UPDATE \"{table}\" SET \"{col}\" = :val WHERE id = :id AND \"{col}\" != :val")
                    res = conn.execute(query, {"val": cf_id, "id": row_id})
                    if res.rowcount > 0:
                        table_updates += 1
            
            logger.info(f"  Updated {table_updates} rows in {table}")
            total_updates += table_updates

    logger.info(f"Sync complete. Total rows updated: {total_updates}")

if __name__ == "__main__":
    sync_live_db()
