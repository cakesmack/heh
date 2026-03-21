from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv('c:/Users/Craig/Desktop/projects/antigrav/heh/highland_events_app/backend/.env')
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    print("SHORT EVENT IDS:")
    result = conn.execute(text("SELECT id FROM events WHERE length(id) < 32")).fetchall()
    for row in result:
        print(f"  {row[0]}")
