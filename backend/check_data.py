from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv('c:/Users/Craig/Desktop/projects/antigrav/heh/highland_events_app/backend/.env')
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    print("USER SAMPLE ID:")
    result = conn.execute(text("SELECT id FROM users LIMIT 1")).fetchone()
    if result: print(f"  {result[0]}")
    
    print("\nEVENT SAMPLE ID:")
    result = conn.execute(text("SELECT id FROM events LIMIT 1")).fetchone()
    if result: print(f"  {result[0]}")
    
    print("\nATTENDEE SAMPLE DATA:")
    result = conn.execute(text("SELECT id, user_id, event_id FROM event_attendees LIMIT 5")).fetchall()
    for row in result:
        print(f"  ID: {row[0]}, USER_ID: {row[1]}, EVENT_ID: {row[2]}")
