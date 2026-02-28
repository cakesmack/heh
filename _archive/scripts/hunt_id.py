import os
import sys
from sqlalchemy import create_engine, text, inspect

# Add backend directory to python path
backend_dir = r"c:\Users\Craig\Desktop\projects\antigrav\heh\highland_events_app\backend"
sys.path.append(backend_dir)

from app.core.config import settings

def hunt_id(search_str):
    db_url = str(settings.DATABASE_URL).replace("postgres://", "postgresql://", 1)
    engine = create_engine(db_url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print(f"Hunting for: {search_str}")
    found = False
    with engine.connect() as conn:
        for table in tables:
            try:
                res = conn.execute(text(f"SELECT * FROM \"{table}\" LIMIT 0"))
                columns = res.keys()
                for col in columns:
                    query = text(f"SELECT id FROM \"{table}\" WHERE CAST(\"{col}\" AS TEXT) LIKE :s")
                    rows = conn.execute(query, {"s": f"%{search_str}%"}).fetchall()
                    if rows:
                        print(f"FOUND in {table}.{col} | Row IDs: {[r[0] for r in rows]}")
                        found = True
            except:
                continue
    if not found:
        print("Not found in local database.")

if __name__ == "__main__":
    # The user's ID: kbdwhlx3q7usaghoxizc
    hunt_id("kbdwhlx3q7usaghoxizc")
