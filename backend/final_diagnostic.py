from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv('c:/Users/Craig/Desktop/projects/antigrav/heh/highland_events_app/backend/.env')
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # 1. Get a user and an event that should be linked
    print("CHECKING ALL ATTENDANCE LINKS:")
    result = conn.execute(text("SELECT user_id, event_id FROM event_attendees")).fetchall()
    
    for row in result:
        u_id, e_id = row
        print(f"\nLink: User={u_id!r}, Event={e_id!r}")
        
        # Check users table
        u_exists = conn.execute(text("SELECT id FROM users WHERE id = :u_id"), {"u_id": u_id}).fetchone()
        u_exists_norm = conn.execute(text("SELECT id FROM users WHERE lower(replace(id, '-', '')) = :u_id"), {"u_id": u_id}).fetchone()
        
        # Check events table
        e_exists = conn.execute(text("SELECT id FROM events WHERE id = :e_id"), {"e_id": e_id}).fetchone()
        e_exists_norm = conn.execute(text("SELECT id FROM events WHERE lower(replace(id, '-', '')) = :e_id"), {"e_id": e_id}).fetchone()
        
        print(f"  User exists (direct): {u_exists is not None}")
        print(f"  User exists (normalized search): {u_exists_norm is not None}")
        print(f"  Event exists (direct): {e_exists is not None}")
        print(f"  Event exists (normalized search): {e_exists_norm is not None}")
        
        if u_exists_norm:
             print(f"  Event id in events table: {e_exists_norm[0]!r}")
