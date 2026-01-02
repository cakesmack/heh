#!/usr/bin/env python3
"""
Bulk Import Script for Highland Events Hub.

Imports events from CSV with intelligent venue name matching.
Also generates template CSV files for events and venues.

Usage:
    cd backend
    python -m scripts.bulk_import [--import events.csv] [--templates]

Examples:
    python -m scripts.bulk_import --templates              # Generate templates only
    python -m scripts.bulk_import --import events.csv      # Import events from CSV
    python -m scripts.bulk_import --import events.csv --dry-run  # Preview without importing
"""

import argparse
import csv
import sys
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional
from uuid import uuid4

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import Session, select
from app.core.database import engine
from app.models.venue import Venue
from app.models.event import Event
from app.models.category import Category
from app.models.user import User


# ============================================================================
# Configuration
# ============================================================================

FUZZY_MATCH_THRESHOLD = 0.8  # 80% similarity required for fuzzy match
ERROR_LOG_FILE = "import_errors.txt"

# Template CSV headers
EVENT_TEMPLATE_HEADERS = [
    "title",
    "description",
    "date_start",
    "date_end",
    "venue_name",  # Matched to venue_id
    "category_name",  # Optional, matched to category_id
    "price",
    "ticket_url",
    "image_url",
    "age_restriction",
]

VENUE_TEMPLATE_HEADERS = [
    "name",
    "address",
    "latitude",
    "longitude",
    "postcode",
    "category",  # e.g., "Pub", "Hall", "Outdoor"
    "description",
    "website",
    "phone",
    "is_dog_friendly",
    "has_wheelchair_access",
    "has_parking",
    "serves_food",
]


# ============================================================================
# Venue Matching
# ============================================================================

def normalize_venue_name(name: str) -> str:
    """Normalize venue name for comparison."""
    return name.lower().strip().replace("'", "").replace("'", "")


def fuzzy_match_score(s1: str, s2: str) -> float:
    """Calculate similarity score between two strings (0.0 to 1.0)."""
    return SequenceMatcher(None, normalize_venue_name(s1), normalize_venue_name(s2)).ratio()


def find_venue_by_name(session: Session, venue_name: str) -> tuple[Optional[Venue], str]:
    """
    Find a venue by name using exact match first, then fuzzy matching.

    Returns:
        (venue, match_type) where match_type is 'exact', 'fuzzy', or 'not_found'
    """
    if not venue_name:
        return None, "empty"

    normalized_name = normalize_venue_name(venue_name)

    # Get all venues
    venues = session.exec(select(Venue)).all()

    # Try exact match first (case-insensitive)
    for venue in venues:
        if normalize_venue_name(venue.name) == normalized_name:
            return venue, "exact"

    # Try fuzzy match
    best_match = None
    best_score = 0.0

    for venue in venues:
        score = fuzzy_match_score(venue_name, venue.name)
        if score > best_score and score >= FUZZY_MATCH_THRESHOLD:
            best_score = score
            best_match = venue

    if best_match:
        return best_match, f"fuzzy ({best_score:.0%})"

    return None, "not_found"


def find_category_by_name(session: Session, category_name: str) -> Optional[Category]:
    """Find a category by name (case-insensitive)."""
    if not category_name:
        return None

    normalized = category_name.lower().strip()
    categories = session.exec(select(Category).where(Category.is_active == True)).all()

    for cat in categories:
        if cat.name.lower() == normalized or cat.slug.lower() == normalized:
            return cat

    return None


# ============================================================================
# Import Logic
# ============================================================================

def parse_datetime(date_str: str) -> Optional[datetime]:
    """Parse datetime from various formats."""
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue

    return None


def import_events_from_csv(csv_path: Path, organizer_email: str, dry_run: bool = False) -> dict:
    """
    Import events from a CSV file.

    Args:
        csv_path: Path to events CSV file
        organizer_email: Email of the user to set as organizer
        dry_run: If True, validate only without inserting

    Returns:
        dict with 'success', 'errors', and 'skipped' counts
    """
    results = {"success": 0, "errors": [], "skipped": 0}

    if not csv_path.exists():
        results["errors"].append(f"CSV file not found: {csv_path}")
        return results

    with Session(engine) as session:
        # Find organizer
        organizer = session.exec(
            select(User).where(User.email == organizer_email)
        ).first()

        if not organizer:
            results["errors"].append(f"Organizer not found with email: {organizer_email}")
            return results

        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)

            for row_num, row in enumerate(reader, start=2):  # Start at 2 for header
                try:
                    # Required fields
                    title = row.get("title", "").strip()
                    if not title:
                        results["errors"].append(f"Row {row_num}: Missing required field 'title'")
                        continue

                    # Parse dates
                    date_start = parse_datetime(row.get("date_start", ""))
                    date_end = parse_datetime(row.get("date_end", ""))

                    if not date_start:
                        results["errors"].append(f"Row {row_num}: Invalid or missing 'date_start'")
                        continue

                    if not date_end:
                        # Default to 2 hours after start
                        date_end = date_start + timedelta(hours=2)

                    # Match venue
                    venue_name = row.get("venue_name", "").strip()
                    venue, match_type = find_venue_by_name(session, venue_name)

                    if not venue:
                        results["errors"].append(
                            f"Row {row_num}: Venue not found: '{venue_name}'"
                        )
                        continue

                    # Match category (optional)
                    category_name = row.get("category_name", "").strip()
                    category = find_category_by_name(session, category_name) if category_name else None

                    # Parse price
                    price_str = row.get("price", "0").strip()
                    try:
                        price = float(price_str) if price_str else 0.0
                    except ValueError:
                        price = 0.0

                    if dry_run:
                        print(f"[OK] Row {row_num}: '{title}' -> {venue.name} ({match_type})")
                        results["success"] += 1
                        continue

                    # Create event
                    event = Event(
                        id=str(uuid4()).replace("-", ""),
                        title=title,
                        description=row.get("description", "").strip() or None,
                        date_start=date_start,
                        date_end=date_end,
                        venue_id=venue.id,
                        latitude=venue.latitude,
                        longitude=venue.longitude,
                        geohash=venue.geohash,
                        category_id=category.id if category else None,
                        price=price,
                        ticket_url=row.get("ticket_url", "").strip() or None,
                        image_url=row.get("image_url", "").strip() or None,
                        age_restriction=row.get("age_restriction", "").strip() or None,
                        organizer_id=organizer.id,
                        status="published",
                    )

                    session.add(event)
                    results["success"] += 1
                    print(f"[OK] Row {row_num}: Imported '{title}' -> {venue.name} ({match_type})")

                except Exception as e:
                    results["errors"].append(f"Row {row_num}: {str(e)}")

        if not dry_run and results["success"] > 0:
            session.commit()
            print(f"\n[DONE] Committed {results['success']} events to database")

    return results


# ============================================================================
# Template Generation
# ============================================================================

def generate_templates(output_dir: Path = None):
    """Generate template CSV files for events and venues."""
    if output_dir is None:
        # Default to project root (heh/)
        output_dir = Path(__file__).parent.parent.parent.parent

    output_dir = Path(output_dir)

    # Event template with example row
    event_template_path = output_dir / "template_events.csv"
    with open(event_template_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(EVENT_TEMPLATE_HEADERS)
        writer.writerow([
            "Highland Ceilidh Night",
            "Traditional Scottish dancing and live music",
            "2025-03-15 19:00",
            "2025-03-15 23:00",
            "The Clansman Hotel",  # venue_name
            "Live Music",  # category_name
            "15.00",
            "https://tickets.example.com/ceilidh",
            "",
            "All ages",
        ])

    print(f"[CREATED] {event_template_path}")

    # Venue template with example row
    venue_template_path = output_dir / "template_venues.csv"
    with open(venue_template_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(VENUE_TEMPLATE_HEADERS)
        writer.writerow([
            "The Clansman Hotel",
            "High Street, Fort Augustus",
            "57.1444",
            "-4.6806",
            "PH32 4AU",
            "Pub",
            "Historic hotel and pub on the Caledonian Canal",
            "https://example.com",
            "01456 450250",
            "true",   # is_dog_friendly
            "true",   # has_wheelchair_access
            "true",   # has_parking
            "true",   # serves_food
        ])

    print(f"[CREATED] {venue_template_path}")

    return event_template_path, venue_template_path


def write_error_log(errors: list, output_path: Path = None):
    """Write import errors to a log file."""
    if output_path is None:
        output_path = Path(__file__).parent.parent.parent.parent / ERROR_LOG_FILE

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"Import Errors - {datetime.now().isoformat()}\n")
        f.write("=" * 60 + "\n\n")
        for error in errors:
            f.write(f"- {error}\n")

    print(f"\n[WARNING] Errors written to: {output_path}")


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Bulk import events and generate templates for Highland Events Hub",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m scripts.bulk_import --templates
  python -m scripts.bulk_import --import events.csv --organizer admin@example.com
  python -m scripts.bulk_import --import events.csv --organizer admin@example.com --dry-run
        """
    )

    parser.add_argument(
        "--templates",
        action="store_true",
        help="Generate template CSV files (template_events.csv, template_venues.csv)"
    )

    parser.add_argument(
        "--import",
        dest="import_file",
        type=str,
        metavar="CSV_FILE",
        help="Import events from a CSV file"
    )

    parser.add_argument(
        "--organizer",
        type=str,
        default="admin@example.com",
        help="Email of the organizer user for imported events (default: admin@example.com)"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate CSV without actually importing (preview mode)"
    )

    parser.add_argument(
        "--list-venues",
        action="store_true",
        help="List all existing venues in the database"
    )

    parser.add_argument(
        "--list-categories",
        action="store_true",
        help="List all existing categories in the database"
    )

    args = parser.parse_args()

    # Handle --list-venues
    if args.list_venues:
        with Session(engine) as session:
            venues = session.exec(select(Venue).order_by(Venue.name)).all()
            print(f"\n{'='*60}")
            print(f"Existing Venues ({len(venues)} total)")
            print(f"{'='*60}")
            for venue in venues:
                print(f"  - {venue.name}")
                print(f"    Address: {venue.address}")
                print(f"    ID: {venue.id}")
                print()
        return

    # Handle --list-categories
    if args.list_categories:
        with Session(engine) as session:
            categories = session.exec(
                select(Category).where(Category.is_active == True).order_by(Category.display_order)
            ).all()
            print(f"\n{'='*60}")
            print(f"Existing Categories ({len(categories)} total)")
            print(f"{'='*60}")
            for cat in categories:
                print(f"  - {cat.name} (slug: {cat.slug})")
        return

    # Handle --templates
    if args.templates:
        print("\nGenerating template CSV files...")
        generate_templates()
        print("\nDone! Fill in the templates and use --import to import them.")
        return

    # Handle --import
    if args.import_file:
        csv_path = Path(args.import_file)

        print(f"\n{'='*60}")
        if args.dry_run:
            print("DRY RUN - Validating events (no changes will be made)")
        else:
            print("Importing events from CSV")
        print(f"{'='*60}")
        print(f"File: {csv_path}")
        print(f"Organizer: {args.organizer}")
        print()

        results = import_events_from_csv(
            csv_path,
            organizer_email=args.organizer,
            dry_run=args.dry_run
        )

        print(f"\n{'='*60}")
        print(f"Results:")
        print(f"  [OK] Success: {results['success']}")
        print(f"  [ERR] Errors: {len(results['errors'])}")

        if results["errors"]:
            write_error_log(results["errors"])

        return

    # No action specified
    parser.print_help()


if __name__ == "__main__":
    main()
