"""
Merge Duplicates Script
=======================
Identifies existing duplicate events in the database (same title + date_start,
venues within 1 km) and merges them into the most complete record.

Usage:
    python -m scripts.merge_duplicates              # Dry-run (default)
    python -m scripts.merge_duplicates --apply       # Execute merges
    python -m scripts.merge_duplicates --dry-run     # Explicit dry-run

Run from the backend/ directory:
    cd backend
    python -m scripts.merge_duplicates --dry-run
"""
import argparse
import logging
import sys
import os
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# Ensure the backend package is importable when run from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlmodel import Session, select, col
from sqlalchemy import text, func

from app.core.database import engine
from app.models.event import Event
from app.models.venue import Venue
from app.models.bookmark import Bookmark
from app.models.showtime import EventShowtime
from app.models.tag import EventTag
from app.models.event_participating_venue import EventParticipatingVenue
from app.models.event_claim import EventClaim
from app.services.geolocation import haversine_distance

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Maximum distance (km) to treat two venues as "same location"
SAME_LOCATION_KM = 1.0


# ── Scoring ──────────────────────────────────────────────────────────────
def _completeness_score(event: Event) -> int:
    """
    Score an event by how many optional fields are populated.
    Higher = more complete = better candidate to keep.
    """
    score = 0
    check_fields = [
        "description", "image_url", "ticket_url", "price_display",
        "address_full", "latitude", "longitude", "category_id",
        "organizer_profile_id", "website_url", "postcode",
    ]
    for f in check_fields:
        val = getattr(event, f, None)
        if val is not None and val != "":
            score += 1
    # Prefer events with more analytics engagement
    score += min(event.view_count, 10)
    score += min(event.attending_count, 5)
    return score


def _venue_name_length(session: Session, venue_id: Optional[str]) -> int:
    """Longer venue name = more specific."""
    if not venue_id:
        return 0
    venue = session.get(Venue, venue_id)
    return len(venue.name) if venue else 0


# ── Relationship migration ──────────────────────────────────────────────
def _migrate_relationships(
    session: Session,
    survivor_id: str,
    duplicate_id: str,
    dry_run: bool,
) -> Dict[str, int]:
    """
    Move child rows from the duplicate event to the survivor.
    Returns counts of migrated rows per table.
    """
    counts: Dict[str, int] = {}

    # --- Bookmarks (unique on user_id + event_id) ---
    dup_bookmarks = session.exec(
        select(Bookmark).where(Bookmark.event_id == duplicate_id)
    ).all()
    migrated = 0
    for bm in dup_bookmarks:
        # Check if survivor already has this user's bookmark
        existing = session.exec(
            select(Bookmark).where(
                Bookmark.event_id == survivor_id,
                Bookmark.user_id == bm.user_id,
            )
        ).first()
        if existing:
            if not dry_run:
                session.delete(bm)
        else:
            if not dry_run:
                bm.event_id = survivor_id
                session.add(bm)
            migrated += 1
    counts["bookmarks"] = migrated

    # --- Showtimes ---
    dup_showtimes = session.exec(
        select(EventShowtime).where(EventShowtime.event_id == duplicate_id)
    ).all()
    for st in dup_showtimes:
        if not dry_run:
            st.event_id = survivor_id
            session.add(st)
    counts["showtimes"] = len(dup_showtimes)

    # --- EventTags (composite PK: event_id + tag_id) ---
    dup_tags = session.exec(
        select(EventTag).where(EventTag.event_id == duplicate_id)
    ).all()
    migrated = 0
    for et in dup_tags:
        existing = session.exec(
            select(EventTag).where(
                EventTag.event_id == survivor_id,
                EventTag.tag_id == et.tag_id,
            )
        ).first()
        if existing:
            if not dry_run:
                session.delete(et)
        else:
            if not dry_run:
                # Can't update composite PK — delete + re-create
                session.delete(et)
                session.flush()
                new_et = EventTag(event_id=survivor_id, tag_id=et.tag_id)
                session.add(new_et)
            migrated += 1
    counts["tags"] = migrated

    # --- EventParticipatingVenue (composite PK) ---
    dup_pvs = session.exec(
        select(EventParticipatingVenue).where(
            EventParticipatingVenue.event_id == duplicate_id
        )
    ).all()
    migrated = 0
    for pv in dup_pvs:
        existing = session.exec(
            select(EventParticipatingVenue).where(
                EventParticipatingVenue.event_id == survivor_id,
                EventParticipatingVenue.venue_id == pv.venue_id,
            )
        ).first()
        if existing:
            if not dry_run:
                session.delete(pv)
        else:
            if not dry_run:
                session.delete(pv)
                session.flush()
                new_pv = EventParticipatingVenue(
                    event_id=survivor_id, venue_id=pv.venue_id
                )
                session.add(new_pv)
            migrated += 1
    counts["participating_venues"] = migrated

    # --- EventClaim ---
    dup_claims = session.exec(
        select(EventClaim).where(EventClaim.event_id == duplicate_id)
    ).all()
    for cl in dup_claims:
        if not dry_run:
            cl.event_id = survivor_id
            session.add(cl)
    counts["claims"] = len(dup_claims)

    # --- FeaturedBooking (event_id FK, CASCADE) ---
    # Re-point any featured bookings rather than letting CASCADE delete them
    if not dry_run:
        session.execute(
            text(
                "UPDATE featured_bookings SET event_id = :survivor "
                "WHERE event_id = :duplicate"
            ),
            {"survivor": survivor_id, "duplicate": duplicate_id},
        )

    # --- HeroSlot (event_id FK) ---
    if not dry_run:
        session.execute(
            text(
                "UPDATE hero_slots SET event_id = :survivor "
                "WHERE event_id = :duplicate"
            ),
            {"survivor": survivor_id, "duplicate": duplicate_id},
        )

    return counts


# ── Main logic ───────────────────────────────────────────────────────────
def find_and_merge_duplicates(session: Session, dry_run: bool = True) -> dict:
    """
    1. Group events by (title, date_start).
    2. For groups with >1 event, check pairwise venue distances.
    3. Merge nearby duplicates into the most complete record.
    """
    logger.info("=== Duplicate Detection %s ===", "(DRY RUN)" if dry_run else "(APPLY)")

    # Fetch all events with a venue
    all_events = session.exec(
        select(Event).where(Event.status != "cancelled")
    ).all()

    # Group by normalised (title_lower, date_start)
    groups: Dict[Tuple[str, datetime], List[Event]] = defaultdict(list)
    for ev in all_events:
        key = (ev.title.strip().lower(), ev.date_start)
        groups[key].append(ev)

    # Filter to groups with potential duplicates
    dup_groups = {k: v for k, v in groups.items() if len(v) > 1}
    logger.info("Found %d title/date groups with >1 event", len(dup_groups))

    total_merged = 0
    total_deleted = 0
    merge_log: List[dict] = []

    for (title, date_start), events in dup_groups.items():
        # Build venue cache
        venue_cache: Dict[str, Optional[Venue]] = {}
        for ev in events:
            if ev.venue_id and ev.venue_id not in venue_cache:
                venue_cache[ev.venue_id] = session.get(Venue, ev.venue_id)

        # Find clusters of nearby events
        merged_ids = set()
        for i, ev_a in enumerate(events):
            if ev_a.id in merged_ids:
                continue
            cluster = [ev_a]

            for ev_b in events[i + 1:]:
                if ev_b.id in merged_ids:
                    continue

                # Check proximity
                is_nearby = False
                v_a = venue_cache.get(ev_a.venue_id) if ev_a.venue_id else None
                v_b = venue_cache.get(ev_b.venue_id) if ev_b.venue_id else None

                if ev_a.venue_id == ev_b.venue_id:
                    is_nearby = True
                elif v_a and v_b and v_a.latitude and v_b.latitude:
                    dist = haversine_distance(
                        v_a.latitude, v_a.longitude,
                        v_b.latitude, v_b.longitude,
                    )
                    if dist <= SAME_LOCATION_KM:
                        is_nearby = True
                elif not ev_a.venue_id and not ev_b.venue_id:
                    # Both venue-less with same location_name
                    if ev_a.location_name and ev_a.location_name == ev_b.location_name:
                        is_nearby = True

                if is_nearby:
                    cluster.append(ev_b)
                    merged_ids.add(ev_b.id)

            if len(cluster) < 2:
                continue

            # Pick survivor = highest completeness score, tie-break by most
            # specific venue name, then most recently updated
            cluster.sort(
                key=lambda e: (
                    _completeness_score(e),
                    _venue_name_length(session, e.venue_id),
                    e.updated_at or datetime.min,
                ),
                reverse=True,
            )
            survivor = cluster[0]
            duplicates = cluster[1:]

            logger.info(
                "  Cluster: '%s' @ %s — keeping %s, merging %d duplicates",
                title, date_start, survivor.id, len(duplicates),
            )

            for dup in duplicates:
                entry = {
                    "survivor_id": survivor.id,
                    "duplicate_id": dup.id,
                    "title": title,
                    "date_start": str(date_start),
                    "survivor_venue": survivor.venue_id,
                    "duplicate_venue": dup.venue_id,
                }

                # Absorb any non-null fields the survivor is missing
                absorb_fields = [
                    "description", "image_url", "ticket_url", "price_display",
                    "min_price", "min_age", "address_full", "latitude",
                    "longitude", "category_id", "organizer_profile_id",
                    "website_url", "postcode",
                ]
                for field in absorb_fields:
                    survivor_val = getattr(survivor, field, None)
                    dup_val = getattr(dup, field, None)
                    if survivor_val is None and dup_val is not None:
                        if not dry_run:
                            setattr(survivor, field, dup_val)
                        logger.info("    Absorbing %s from %s", field, dup.id)

                # Upgrade venue if duplicate has a more specific one
                dup_spec = _venue_name_length(session, dup.venue_id)
                surv_spec = _venue_name_length(session, survivor.venue_id)
                if dup_spec > surv_spec:
                    logger.info(
                        "    Upgrading venue: %s → %s",
                        survivor.venue_id, dup.venue_id,
                    )
                    if not dry_run:
                        survivor.venue_id = dup.venue_id

                # Migrate relationships
                rel_counts = _migrate_relationships(
                    session, survivor.id, dup.id, dry_run
                )
                entry["migrated_relationships"] = rel_counts

                # Delete duplicate
                if not dry_run:
                    session.delete(dup)
                    survivor.updated_at = datetime.utcnow()
                    session.add(survivor)

                merge_log.append(entry)
                total_deleted += 1

            total_merged += 1

    summary = {
        "groups_merged": total_merged,
        "events_deleted": total_deleted,
        "dry_run": dry_run,
        "details": merge_log,
    }
    return summary


def main():
    parser = argparse.ArgumentParser(
        description="Find and merge duplicate events in the database."
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Show what would be merged without making changes (default).",
    )
    group.add_argument(
        "--apply",
        action="store_true",
        help="Actually execute the merges.",
    )
    args = parser.parse_args()

    dry_run = not args.apply

    with Session(engine) as session:
        try:
            result = find_and_merge_duplicates(session, dry_run=dry_run)

            if not dry_run:
                session.commit()
                logger.info("✅ Changes committed.")
            else:
                session.rollback()
                logger.info("🔍 Dry run complete — no changes made.")

            logger.info(
                "Summary: %d groups merged, %d events deleted",
                result["groups_merged"],
                result["events_deleted"],
            )

            if result["details"]:
                logger.info("\nDetails:")
                for entry in result["details"]:
                    logger.info(
                        "  '%s' @ %s  |  keep=%s  delete=%s  migrated=%s",
                        entry["title"],
                        entry["date_start"],
                        entry["survivor_id"][:8],
                        entry["duplicate_id"][:8],
                        entry.get("migrated_relationships", {}),
                    )

        except Exception:
            session.rollback()
            logger.exception("❌ Error during merge — rolled back.")
            sys.exit(1)


if __name__ == "__main__":
    main()
