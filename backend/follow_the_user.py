from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv('c:/Users/Craig/Desktop/projects/antigrav/heh/highland_events_app/backend/.env')
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("ALL ATTENDEE RECORDS:")
    result = conn.execute(text("SELECT id, user_id, event_id FROM event_attendees")).fetchall()
    for row in result:
        ea_id, u_id, e_id = row
        print(f"EA_ID: {ea_id}")
        user = conn.execute(text("SELECT email, username, id FROM users WHERE id = :u_id"), {"u_id": u_id}).fetchone()
        if user:
            print(f"  User: {user[0]} ({user[1]}) ID={user[2]}")
        else:
            print(f"  USER {u_id} NOT FOUND IN USERS TABLE!")
            # Try searching by email directly? No.
