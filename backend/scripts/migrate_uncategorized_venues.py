"""
Migration Script: Add city column if missing, Ensure 'Uncategorized' venue category & Migrate unverified venues.
"""
import os
import sys
from uuid import uuid4
from sqlmodel import Session, select, text

# Add backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.core.database import engine
from app.models.venue import Venue, VenueStatus
from app.models.venue_category import VenueCategory

def run_migration():
    print("Starting migration: Add city column & Default venue category -> Uncategorized...")
    with Session(engine) as session:
        # 0. Ensure 'city' column exists on 'venues' table
        try:
            session.execute(text("ALTER TABLE venues ADD COLUMN IF NOT EXISTS city VARCHAR(100);"))
            session.commit()
            print("Ensured 'city' column exists on 'venues' table.")
        except Exception as e:
            session.rollback()
            print(f"Column check note: {e}")

        # 1. Ensure 'Uncategorized' category exists
        uncategorized = session.exec(
            select(VenueCategory).where(
                (VenueCategory.slug == "uncategorized") | (VenueCategory.name == "Uncategorized")
            )
        ).first()

        if not uncategorized:
            uncategorized = VenueCategory(
                id=str(uuid4()).replace("-", ""),
                name="Uncategorized",
                slug="uncategorized",
                description="Default category for venues awaiting categorization"
            )
            session.add(uncategorized)
            session.commit()
            session.refresh(uncategorized)
            print(f"Created 'Uncategorized' venue category (ID: {uncategorized.id})")
        else:
            print(f"Found 'Uncategorized' venue category (ID: {uncategorized.id})")

        # 2. Find 'Arena / Stadium' category if present
        arena_category = session.exec(
            select(VenueCategory).where(
                (VenueCategory.name == "Arena / Stadium") | (VenueCategory.slug == "arena-stadium")
            )
        ).first()

        arena_id = arena_category.id if arena_category else None

        # 3. Query all unverified venues currently categorized as 'Arena / Stadium' or with no category
        query = select(Venue).where(
            (Venue.status != VenueStatus.VERIFIED)
        )
        if arena_id:
            query = query.where((Venue.category_id == arena_id) | (Venue.category_id == None))
        else:
            query = query.where(Venue.category_id == None)

        unverified_venues = session.exec(query).all()
        print(f"Found {len(unverified_venues)} unverified venues to update to 'Uncategorized'...")

        updated_count = 0
        for venue in unverified_venues:
            venue.category_id = uncategorized.id
            session.add(venue)
            updated_count += 1

        session.commit()
        print(f"Successfully updated {updated_count} unverified venues to 'Uncategorized'.")

if __name__ == "__main__":
    run_migration()
