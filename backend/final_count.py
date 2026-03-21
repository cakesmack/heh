from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv('c:/Users/Craig/Desktop/projects/antigrav/heh/highland_events_app/backend/.env')
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("COUNT IN event_attendees:")
    count = conn.execute(text("SELECT count(*) FROM event_attendees")).fetchone()
    print(f"Total: {count[0]}")
    
    if count[0] > 0:
        print("\nFIRST RECORD:")
        row = conn.execute(text("SELECT * FROM event_attendees LIMIT 1")).fetchone()
        print(row)
