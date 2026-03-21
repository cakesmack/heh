from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv('c:/Users/Craig/Desktop/projects/antigrav/heh/highland_events_app/backend/.env')
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("EVENT_ATTENDEES RECORDS (Raw SQL):")
    result = conn.execute(text("SELECT id, user_id, event_id FROM event_attendees")).fetchall()
    for row in result:
        print(f"  ID: {row[0]}, USER_ID: {row[1]}, EVENT_ID: {row[2]}")
        
    print("\nCHECKING FOR MISMATCHES:")
    for row in result:
        ea_id, u_id, e_id = row
        # Check users table
        u_match = conn.execute(text("SELECT id FROM users WHERE id = :u_id"), {"u_id": u_id}).fetchone()
        u_match_norm = conn.execute(text("SELECT id FROM users WHERE replace(id, '-', '') = :u_id"), {"u_id": u_id.replace('-', '')}).fetchone()
        
        # Check events table
        e_match = conn.execute(text("SELECT id FROM events WHERE id = :e_id"), {"e_id": e_id}).fetchone()
        e_match_norm = conn.execute(text("SELECT id FROM events WHERE replace(id, '-', '') = :e_id"), {"e_id": e_id.replace('-', '')}).fetchone()
        
        print(f"  Entry [U:{u_id}, E:{e_id}]")
        print(f"    User direct match: {u_match is not None}")
        print(f"    User normalized match: {u_match_norm is not None}")
        print(f"    Event direct match: {e_match is not None}")
        print(f"    Event normalized match: {e_match_norm is not None}")
