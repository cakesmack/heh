from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv('c:/Users/Craig/Desktop/projects/antigrav/heh/highland_events_app/backend/.env')
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    print("USERS TABLE:")
    result = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users'")).fetchall()
    for row in result:
        print(f"  {row[0]}: {row[1]}")
        
    print("\nEVENTS TABLE:")
    result = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='events'")).fetchall()
    for row in result:
        print(f"  {row[0]}: {row[1]}")
        
    print("\nEVENT_ATTENDEES TABLE:")
    result = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='event_attendees'")).fetchall()
    for row in result:
        print(f"  {row[0]}: {row[1]}")
