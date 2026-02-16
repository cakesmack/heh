import os
import sys
import asyncio
import httpx
from sqlalchemy import create_engine, text, inspect
from typing import List, Dict

# Add backend directory to python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)

from app.core.config import settings
from app.services.cloudflare_service import upload_url_to_cloudflare, is_cloudflare_configured

async def cutover_images():
    if not is_cloudflare_configured():
        print("ERROR: Cloudflare Images not configured in .env")
        return

    db_url = str(settings.DATABASE_URL).replace("postgres://", "postgresql://", 1)
    engine = create_engine(db_url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print("Starting final image cutover...")
    
    async with httpx.AsyncClient() as client:
        for table in tables:
            try:
                # Get columns for this table
                with engine.connect() as conn:
                    res = conn.execute(text(f"SELECT * FROM {table} LIMIT 0"))
                    columns = res.keys()
                
                for col in columns:
                    # Find rows with Cloudinary URLs
                    query = text(f"SELECT id, \"{col}\" FROM \"{table}\" WHERE CAST(\"{col}\" AS TEXT) LIKE '%res.cloudinary.com%'")
                    
                    with engine.connect() as conn:
                        rows = conn.execute(query).fetchall()
                    
                    if not rows:
                        continue
                        
                    print(f"\nProcessing {len(rows)} rows in {table}.{col}...")
                    
                    for row in rows:
                        row_id = row[0]
                        cloudinary_url = row[1]
                        
                        try:
                            print(f"  Migrating: {cloudinary_url}")
                            # Upload to Cloudflare
                            cloudflare_id = await upload_url_to_cloudflare(cloudinary_url, client=client)
                            
                            # Update DB with Raw ID
                            update_query = text(f"UPDATE \"{table}\" SET \"{col}\" = :cf_id WHERE id = :r_id")
                            with engine.begin() as conn:
                                conn.execute(update_query, {"cf_id": cloudflare_id, "r_id": row_id})
                            
                            print(f"  SUCCESS: {row_id} updated to {cloudflare_id}")
                        except Exception as e:
                            print(f"  FAILED: {cloudinary_url} -> {e}")
                            
            except Exception as e:
                print(f"Error processing table {table}: {e}")
                continue

    print("\nCutover completed.")

if __name__ == "__main__":
    asyncio.run(cutover_images())
