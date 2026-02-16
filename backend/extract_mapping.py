import os
import sys
import json
from sqlalchemy import create_engine, text, inspect

# Add backend directory to python path
backend_dir = r"c:\Users\Craig\Desktop\projects\antigrav\heh\highland_events_app\backend"
sys.path.append(backend_dir)

from app.core.config import settings

def extract_db_mapping():
    db_url = str(settings.DATABASE_URL).replace("postgres://", "postgresql://", 1)
    engine = create_engine(db_url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    mapping = {} # Format: { "table": { "pk_id": { "col": "uuid" } } }
    
    with engine.connect() as conn:
        for table in tables:
            try:
                # Check for image-related columns
                res = conn.execute(text(f"SELECT * FROM \"{table}\" LIMIT 0"))
                columns = res.keys()
                
                img_cols = [c for c in columns if any(k in c.lower() for k in ["url", "image", "logo", "avatar", "hero", "path", "override"])]
                if not img_cols:
                    continue
                
                # We need the 'id' column to map
                if 'id' not in columns:
                    continue
                    
                # Fetch all rows that have a raw UUID (Cloudflare ID)
                # Pattern: UUID (8-4-4-4-12)
                for col in img_cols:
                    query = text(f"SELECT id, \"{col}\" FROM \"{table}\" WHERE \"{col}\" ~ '^[0-9a-f]{{8}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{12}}$'")
                    rows = conn.execute(query).fetchall()
                    
                    if rows:
                        if table not in mapping:
                            mapping[table] = {}
                        for r_id, cf_id in rows:
                            if str(r_id) not in mapping[table]:
                                mapping[table][str(r_id)] = {}
                            mapping[table][str(r_id)][col] = cf_id
                            
                print(f"Extracted mappings for table: {table}")
            except Exception as e:
                print(f"Error extracting from {table}: {e}")
                continue
                
    output_path = r"c:\Users\Craig\Desktop\projects\antigrav\heh\highland_events_app\backend\db_cf_mapping.json"
    with open(output_path, 'w') as f:
        json.dump(mapping, f, indent=2)
    
    total_ids = sum(len(cols) for t in mapping.values() for r in t.values() for cols in r)
    print(f"Total mappings saved: {total_ids} across {len(mapping)} tables")

if __name__ == "__main__":
    extract_db_mapping()
