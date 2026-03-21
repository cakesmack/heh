from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv('c:/Users/Craig/Desktop/projects/antigrav/heh/highland_events_app/backend/.env')
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("DETAILED DATA CHECK:")
    result = conn.execute(text("SELECT id, user_id, event_id FROM event_attendees")).fetchall()
    for row in result:
        print(f"Record ID: {row[0]!r}")
        print(f"  USER_ID: {row[1]!r} (len={len(row[1])})")
        print(f"  EVENT_ID: {row[2]!r} (len={len(row[2])})")
        
    print("\nSAMPLE USER ID FROM USERS TABLE:")
    u_sample = conn.execute(text("SELECT id FROM users LIMIT 1")).fetchone()
    if u_sample:
        print(f"  User ID: {u_sample[0]!r} (len={len(u_sample[0])})")

    print("\nSAMPLE EVENT ID FROM EVENTS TABLE:")
    e_sample = conn.execute(text("SELECT id FROM events LIMIT 1")).fetchone()
    if e_sample:
        print(f"  Event ID: {e_sample[0]!r} (len={len(e_sample[0])})")
