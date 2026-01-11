import sys
import os
from dotenv import load_dotenv

# 1. Setup Path
# Add 'backend' to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.append(backend_dir)

# 2. Load Env
# Try loading .env from backend root or project root
load_dotenv(os.path.join(backend_dir, ".env"))
# Also try project root if needed
load_dotenv(os.path.join(backend_dir, "..", ".env"))

print(f"Path setup: Added {backend_dir} to sys.path")

try:
    from sqlmodel import Session, delete
    from app.core.database import engine
    from app.models.featured_booking import FeaturedBooking

    def clean_featured_bookings():
        with Session(engine) as session:
            print("Cleaning FeaturedBooking table...")
            # Delete all
            statement = delete(FeaturedBooking)
            result = session.exec(statement)
            session.commit()
            print(f"SUCCESS: Deleted {result.rowcount} records from FeaturedBooking.")

    if __name__ == "__main__":
        clean_featured_bookings()

except Exception as e:
    print(f"ERROR: {e}")
    # Print env vars to debug (be careful with secrets in logs, but verify key ones exist)
    print(f"SECRET_KEY present: {'SECRET_KEY' in os.environ}")
    sys.exit(1)
