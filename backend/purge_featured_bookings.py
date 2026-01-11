import sys
import os

# Set dummy env vars to satisfy Settings validation
os.environ["SECRET_KEY"] = "insecure_key_for_script_only"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_123"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_123"

# Add backend directory to path so we can import app modules
sys.path.append(os.path.dirname(__file__))

from sqlmodel import text
from app.core.database import get_session

def purge_data():
    print("WARNING: This will DELETE ALL DATA from 'featured_bookings' table.")
    print("Starting purge...")
    
    session_gen = get_session()
    session = next(session_gen)
    
    try:
        # Use SQLModel delete statement
        from app.models.featured_booking import FeaturedBooking
        from sqlmodel import delete
        
        statement = delete(FeaturedBooking)
        session.exec(statement)
        session.commit()
        
        print("Purge complete. 'featured_bookings' table is now empty.")
        
    except Exception as e:
        print(f"Error purging data: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    purge_data()
