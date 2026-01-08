"""
Migration Script: Event Price and Age Restriction Schema Changes
Run this script to migrate the database schema for:
1. price: float -> price: str (with min_price: float for filtering)
2. age_restriction: str -> age_restriction: int

Usage: python scripts/migrate_price_age.py
"""

import os
import sys
import re

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker

def get_database_url():
    """Get database URL from environment or use default SQLite."""
    return os.environ.get("DATABASE_URL", "sqlite:///./highland_events.db")

def parse_price_to_min_price(price_str: str) -> float:
    """
    Parse a price string and extract the minimum price as a float.
    
    Examples:
        "Free" -> 0.0
        "Donation" -> 0.0
        "£5" -> 5.0
        "£5 - £10" -> 5.0
        "5.99" -> 5.99
        "From £12.50" -> 12.5
    """
    if not price_str:
        return 0.0
    
    price_lower = price_str.lower().strip()
    
    # Check for free/donation keywords
    if any(keyword in price_lower for keyword in ['free', 'donation', 'n/a', 'tbc', 'tba']):
        return 0.0
    
    # Try to find any number in the string (first match)
    match = re.search(r'[\d]+\.?[\d]*', price_str)
    if match:
        try:
            return float(match.group())
        except ValueError:
            return 0.0
    
    return 0.0

def parse_age_to_int(age_str: str) -> int | None:
    """
    Parse an age restriction string and extract the numeric value.
    
    Examples:
        "" or None -> None (no restriction)
        "All Ages" -> 0
        "18+" -> 18
        "21" -> 21
        "Family Friendly" -> 0
    """
    if not age_str:
        return None
    
    age_lower = age_str.lower().strip()
    
    # Check for "all ages" or "family" keywords
    if any(keyword in age_lower for keyword in ['all ages', 'family', 'all-ages']):
        return 0
    
    # Try to find any number in the string
    match = re.search(r'(\d+)', age_str)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None
    
    return None

def run_migration():
    """Run the database migration."""
    database_url = get_database_url()
    
    # Handle Render's postgres:// URL format
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    print(f"Connecting to database...")
    engine = create_engine(database_url)
    
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns('events')]
    
    print(f"Current columns: {columns}")
    
    with engine.begin() as conn:
        # Step 1: Add new columns if they don't exist
        if 'price_display' not in columns:
            print("Adding price_display column...")
            conn.execute(text("ALTER TABLE events ADD COLUMN price_display VARCHAR(100)"))
        
        if 'min_price' not in columns:
            print("Adding min_price column...")
            conn.execute(text("ALTER TABLE events ADD COLUMN min_price FLOAT DEFAULT 0.0"))
        
        if 'min_age' not in columns:
            print("Adding min_age column...")
            conn.execute(text("ALTER TABLE events ADD COLUMN min_age INTEGER"))
        
        # Step 2: Migrate existing data
        print("Migrating existing price data...")
        
        # Get all events with their current price values
        result = conn.execute(text("SELECT id, price, age_restriction FROM events"))
        events = result.fetchall()
        
        for event in events:
            event_id, old_price, old_age = event
            
            # Convert float price to display string
            if old_price is not None:
                if old_price == 0:
                    new_price_display = "Free"
                else:
                    new_price_display = f"£{old_price:.2f}"
                new_min_price = float(old_price)
            else:
                new_price_display = "Free"
                new_min_price = 0.0
            
            # Convert age restriction string to int
            new_min_age = parse_age_to_int(old_age) if old_age else None
            
            # Update the record
            conn.execute(
                text("""
                    UPDATE events 
                    SET price_display = :price_display, 
                        min_price = :min_price,
                        min_age = :min_age
                    WHERE id = :id
                """),
                {
                    "price_display": new_price_display,
                    "min_price": new_min_price,
                    "min_age": new_min_age,
                    "id": event_id
                }
            )
        
        print(f"Migrated {len(events)} events.")
    
    print("Migration complete!")
    print("\nNOTE: The following changes were made:")
    print("  - Added 'price_display' column (VARCHAR) for user-facing price text")
    print("  - Added 'min_price' column (FLOAT) for search filtering")
    print("  - Added 'min_age' column (INTEGER) for age restriction")
    print("\nThe original 'price' and 'age_restriction' columns are preserved.")
    print("Update event.py model to use the new columns.")

if __name__ == "__main__":
    run_migration()
