"""
Migration script to create slot_pricing table and seed initial pricing.

Run once: cd backend && python -m app.scripts.migrate_slot_pricing
"""
import sys
from pathlib import Path
from datetime import datetime

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from sqlmodel import SQLModel, Session
from app.core.database import engine
from app.models.slot_pricing import SlotPricing, DEFAULT_PRICING
from app.models.featured_booking import SlotType


def run_migration():
    """Create slot_pricing table and seed with default values."""

    # Create table if not exists
    print("Creating slot_pricing table...")
    SQLModel.metadata.create_all(engine, tables=[SlotPricing.__table__])
    print("Table created (or already exists)")

    # Seed default pricing
    with Session(engine) as session:
        for slot_type in SlotType:
            existing = session.get(SlotPricing, slot_type.value)
            if existing:
                print(f"  {slot_type.value}: already exists, skipping")
                continue

            defaults = DEFAULT_PRICING.get(slot_type.value, {})
            pricing = SlotPricing(
                slot_type=slot_type.value,
                price_per_day=defaults.get("price_per_day", 1000),
                min_days=defaults.get("min_days", 3),
                max_concurrent=defaults.get("max_concurrent", 3),
                is_active=True,
                description=defaults.get("description", ""),
                updated_at=datetime.utcnow()
            )
            session.add(pricing)
            print(f"  {slot_type.value}: created with price {pricing.price_per_day} pence/day")

        session.commit()

    print("Migration complete!")


if __name__ == "__main__":
    run_migration()
