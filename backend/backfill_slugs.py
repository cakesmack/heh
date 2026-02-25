"""
Backfill slugs for all existing events and venues.

Usage:
    cd backend
    python -m app.scripts.backfill_slugs
"""
import sys
import os

# Ensure the app package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlmodel import Session, select
from app.core.database import engine
from app.models.event import Event
from app.models.venue import Venue
from app.core.utils import generate_seo_slug


def backfill_event_slugs(session: Session) -> int:
    """Generate slugs for all events that don't have one."""
    events = session.exec(select(Event).where(Event.slug == None)).all()  # noqa: E711
    count = 0

    for event in events:
        # Build base slug from title
        base = generate_seo_slug(event.title)

        # Append venue name for keyword richness
        if event.venue and event.venue.name:
            venue_part = generate_seo_slug(event.venue.name, max_length=30)
            base = f"{base}-{venue_part}"

        # Append month-year from start date
        if event.date_start:
            date_part = event.date_start.strftime("%b-%Y").lower()
            base = f"{base}-{date_part}"

        # Truncate to 300 chars max
        slug = base[:300]

        # Ensure uniqueness: append numeric suffix if collision
        candidate = slug
        suffix = 1
        while session.exec(
            select(Event).where(Event.slug == candidate, Event.id != event.id)
        ).first():
            candidate = f"{slug}-{suffix}"
            suffix += 1

        event.slug = candidate
        session.add(event)
        count += 1

    return count


def backfill_venue_slugs(session: Session) -> int:
    """Generate slugs for all venues that don't have one."""
    venues = session.exec(select(Venue).where(Venue.slug == None)).all()  # noqa: E711
    count = 0

    for venue in venues:
        base = generate_seo_slug(venue.name)

        # Append city from address for keyword richness
        if venue.address:
            parts = [p.strip() for p in venue.address.split(',')]
            if len(parts) >= 2:
                city_part = generate_seo_slug(parts[-2], max_length=30)
                base = f"{base}-{city_part}"

        slug = base[:300]

        # Ensure uniqueness
        candidate = slug
        suffix = 1
        while session.exec(
            select(Venue).where(Venue.slug == candidate, Venue.id != venue.id)
        ).first():
            candidate = f"{slug}-{suffix}"
            suffix += 1

        venue.slug = candidate
        session.add(venue)
        count += 1

    return count


def main():
    print("Backfilling slugs for events and venues...")
    with Session(engine) as session:
        event_count = backfill_event_slugs(session)
        venue_count = backfill_venue_slugs(session)
        session.commit()
        print(f"✓ Backfilled {event_count} event slugs")
        print(f"✓ Backfilled {venue_count} venue slugs")


if __name__ == "__main__":
    main()
