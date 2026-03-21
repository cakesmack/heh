from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv('c:/Users/Craig/Desktop/projects/antigrav/heh/highland_events_app/backend/.env')
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    print("USER_ID lengths in event_attendees:")
    result = conn.execute(text("SELECT length(user_id), count(*) FROM event_attendees GROUP BY length(user_id)")).fetchall()
    for row in result:
        print(f"  Length {row[0]}: {row[1]} records")
        
    print("\nEVENT_ID lengths in event_attendees:")
    result = conn.execute(text("SELECT length(event_id), count(*) FROM event_attendees GROUP BY length(event_id)")).fetchall()
    for row in result:
        print(f"  Length {row[0]}: {row[1]} records")
        
    print("\nAre there records in event_attendees that don't match any user or event?")
    orphans_user = conn.execute(text("SELECT count(*) FROM event_attendees WHERE user_id NOT IN (SELECT id FROM users)")).fetchone()
    orphans_event = conn.execute(text("SELECT count(*) FROM event_attendees WHERE event_id NOT IN (SELECT id FROM events)")).fetchone()
    print(f"  Orphaned users: {orphans_user[0]}")
    print(f"  Orphaned events: {orphans_event[0]}")
