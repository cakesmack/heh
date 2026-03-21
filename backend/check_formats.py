from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv('c:/Users/Craig/Desktop/projects/antigrav/heh/highland_events_app/backend/.env')
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    print("USER ID FORMATS:")
    hyphenated = conn.execute(text("SELECT count(*) FROM users WHERE id LIKE '%-%'")).fetchone()[0]
    unhyphenated = conn.execute(text("SELECT count(*) FROM users WHERE id NOT LIKE '%-%'")).fetchone()[0]
    print(f"  Hyphenated: {hyphenated}, Unhyphenated: {unhyphenated}")
    
    print("\nEVENT ID FORMATS:")
    hyphenated = conn.execute(text("SELECT count(*) FROM events WHERE id LIKE '%-%'")).fetchone()[0]
    unhyphenated = conn.execute(text("SELECT count(*) FROM events WHERE id NOT LIKE '%-%'")).fetchone()[0]
    print(f"  Hyphenated: {hyphenated}, Unhyphenated: {unhyphenated}")
