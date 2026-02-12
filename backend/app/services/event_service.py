"""
Event service — reusable upsert and cleanup logic for event imports.

Provides:
  - upsert_event():   "get-or-create" pattern for single-event imports.
  - cleanup_stale_venue_events(): marks ghost events as cancelled after a batch.

Fuzzy matching:
  When an exact (title + date + venue) match is not found, the service
  searches for events with the same title + date whose venue is within
  1 km of the incoming venue.  This prevents duplicates caused by the
  same event being scraped under slightly different venue records
  (e.g. "Dornoch" vs "Dornoch South Car & Coach Park").
"""
import logging
from datetime import datetime
from typing import List, Optional, Tuple
from uuid import uuid4

from sqlmodel import Session, select

from app.core.utils import normalize_uuid
from app.models.event import Event
from app.models.venue import Venue
from app.services.geolocation import haversine_distance

logger = logging.getLogger(__name__)

# Maximum distance (km) between two venues to consider them "same location"
_SAME_LOCATION_KM = 1.0


def find_existing_event(
    session: Session,
    title: str,
    date_start: datetime,
    venue_id: Optional[str],
    location_name: Optional[str] = None,
) -> Optional[Event]:
    """
    Look up an event by its natural key with fuzzy venue matching.

    Strategy (evaluated in order):
      1. Exact match on (title, date_start, venue_id).
      2. Fuzzy match: same title + date_start, candidate venue within 1 km.
      3. Fallback: match on (title, date_start, location_name) for venue-less
         events.

    Returns the existing Event or None.
    """
    # ------------------------------------------------------------------
    # 1. Exact venue match (fastest path)
    # ------------------------------------------------------------------
    if venue_id:
        exact = session.exec(
            select(Event).where(
                Event.venue_id == venue_id,
                Event.title == title,
                Event.date_start == date_start,
            )
        ).first()
        if exact:
            return exact

        # --------------------------------------------------------------
        # 2. Fuzzy geo match — same title & date, venue within 1 km
        # --------------------------------------------------------------
        incoming_venue = session.get(Venue, venue_id)
        if incoming_venue and incoming_venue.latitude is not None:
            candidates = session.exec(
                select(Event).where(
                    Event.title == title,
                    Event.date_start == date_start,
                    Event.venue_id.isnot(None),  # type: ignore[union-attr]
                )
            ).all()

            for candidate in candidates:
                if candidate.venue_id == venue_id:
                    # Already checked above
                    continue
                cand_venue = session.get(Venue, candidate.venue_id)
                if (
                    cand_venue
                    and cand_venue.latitude is not None
                    and cand_venue.longitude is not None
                ):
                    dist = haversine_distance(
                        incoming_venue.latitude,
                        incoming_venue.longitude,
                        cand_venue.latitude,
                        cand_venue.longitude,
                    )
                    if dist <= _SAME_LOCATION_KM:
                        logger.info(
                            "Fuzzy match: '%s' venue '%s' ↔ '%s' (%.2f km)",
                            title,
                            incoming_venue.name,
                            cand_venue.name,
                            dist,
                        )
                        return candidate

    # ------------------------------------------------------------------
    # 3. Fallback: location_name for venue-less events
    # ------------------------------------------------------------------
    if location_name:
        return session.exec(
            select(Event).where(
                Event.location_name == location_name,
                Event.title == title,
                Event.date_start == date_start,
            )
        ).first()

    return None


# Fields that are safe to overwrite on re-import.
# Anything NOT in this list (id, organizer_id, status, created_at, etc.) is preserved.
_UPDATABLE_FIELDS = [
    "description",
    "image_url",
    "ticket_url",
    "price_display",
    "min_price",
    "min_age",
    "date_end",
    "address_full",
    "latitude",
    "longitude",
    "category_id",
    "organizer_profile_id",
    "location_name",
]


def _venue_specificity(session: Session, venue_id: Optional[str]) -> int:
    """Return a simple specificity score for a venue (longer name = more specific)."""
    if not venue_id:
        return 0
    venue = session.get(Venue, venue_id)
    if not venue:
        return 0
    return len(venue.name)


def upsert_event(
    session: Session,
    *,
    title: str,
    date_start: datetime,
    venue_id: Optional[str],
    organizer_id: str,
    fields: dict,
) -> Tuple[Event, bool]:
    """
    Insert or update an event.

    Args:
        session:      Active DB session (caller owns the commit).
        title:        Event title (part of natural key).
        date_start:   Event start datetime (part of natural key).
        venue_id:     Normalized venue UUID or None (part of natural key).
        organizer_id: User ID of the importer / creator.
        fields:       Dict of optional fields to set (description, image_url, etc.).

    Returns:
        (event, created) — the Event instance and whether it was newly created.
    """
    existing = find_existing_event(
        session,
        title=title,
        date_start=date_start,
        venue_id=venue_id,
        location_name=fields.get("location_name"),
    )

    if existing:
        # --- UPDATE path ---
        for key in _UPDATABLE_FIELDS:
            if key in fields and fields[key] is not None:
                setattr(existing, key, fields[key])

        # Upgrade venue to the more specific one (longer name wins)
        if venue_id and venue_id != existing.venue_id:
            new_spec = _venue_specificity(session, venue_id)
            old_spec = _venue_specificity(session, existing.venue_id)
            if new_spec > old_spec:
                logger.info(
                    "Upgrading venue for '%s': %s → %s",
                    title, existing.venue_id, venue_id,
                )
                existing.venue_id = venue_id

        existing.updated_at = datetime.utcnow()
        session.add(existing)
        return existing, False

    # --- CREATE path ---
    new_event = Event(
        id=normalize_uuid(uuid4()),
        title=title,
        date_start=date_start,
        date_end=fields.get("date_end") or date_start,
        venue_id=venue_id,
        organizer_id=organizer_id,
        status="published",  # Admin imports are auto-published
        **{k: v for k, v in fields.items() if k in _UPDATABLE_FIELDS and v is not None},
    )
    session.add(new_event)
    return new_event, True


def cleanup_stale_venue_events(
    session: Session,
    venue_id: str,
    current_import_ids: List[str],
) -> dict:
    """
    Mark future events for a venue as 'cancelled' if they were NOT in the
    latest import batch.  This removes "ghost events" that no longer exist
    at the source (e.g. delisted from a venue's website).

    Only targets:
      - Events for the given venue_id
      - With date_start in the future
      - With status 'published' (don't re-cancel already-cancelled events)
      - NOT in current_import_ids

    Args:
        session:            Active DB session (caller owns the commit).
        venue_id:           The venue to clean up.
        current_import_ids: List of event IDs that were just imported/updated.

    Returns:
        {"cancelled_count": int, "cancelled_ids": list[str]}
    """
    now = datetime.utcnow()

    # Find all future published events for this venue
    all_future = session.exec(
        select(Event).where(
            Event.venue_id == venue_id,
            Event.date_start > now,
            Event.status == "published",
        )
    ).all()

    # Filter out events that were part of this import batch
    import_id_set = set(current_import_ids)
    stale = [e for e in all_future if e.id not in import_id_set]

    cancelled_ids = []
    for event in stale:
        event.status = "cancelled"
        event.updated_at = now
        session.add(event)
        cancelled_ids.append(event.id)
        logger.info("Cancelled stale event: %s (id=%s)", event.title, event.id)

    return {"cancelled_count": len(cancelled_ids), "cancelled_ids": cancelled_ids}

