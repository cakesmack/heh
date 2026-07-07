import re
import unicodedata
from datetime import datetime
from typing import Optional

STOP_WORDS = {"a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is", "it", "no", "not", "of", "on", "or", "such", "that", "the", "their", "then", "there", "these", "they", "this", "to", "was", "will", "with"}

def generate_seo_slug(text: str, max_length: int = 80) -> str:
    """Generate a keyword-rich, SEO-friendly URL slug."""
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    words = [w for w in text.split() if w not in STOP_WORDS]
    slug = "-".join(words)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    if len(slug) > max_length:
        slug = slug[:max_length].rsplit("-", 1)[0]
    return slug

def generate_event_slug(title: str, venue_name: Optional[str], date_start: datetime, event_id: str) -> str:
    """
    Generate event slug in format:
    [title-keywords]-[venue-keywords]-[month]-[year]-[uuid-prefix]
    """
    # 1. Base slug from title
    title_slug = generate_seo_slug(title)
    
    # 2. Add venue name if provided and not already included in the title slug
    if venue_name:
        venue_slug = generate_seo_slug(venue_name)
        if venue_slug not in title_slug:
            title_slug = f"{title_slug}-{venue_slug}"
            
    # 3. Add month/year
    month_year = date_start.strftime("%b-%Y").lower()
    
    # 4. Add unique ID prefix (first 4 characters of normalized UUID)
    short_uuid = event_id.replace("-", "").lower()[:4]
    
    slug = f"{title_slug}-{month_year}-{short_uuid}"
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug

# Mock data to test edge-cases
mock_events = [
    {
        "title": "Gairloch Highland Gathering",
        "venue_name": "Gairloch Community Hall",
        "date_start": datetime(2027, 5, 15),
        "event_id": "056d3c35-a635-495b-8ec0-94b56011e9ca",
        "description": "Standard clean title"
    },
    {
        "title": "Gairloch Highland Gathering!!!",
        "venue_name": "Gairloch Community Hall",
        "date_start": datetime(2027, 5, 15),
        "event_id": "8ec03c35-a635-495b-8ec0-94b56011e9ca",
        "description": "Special characters at end"
    },
    {
        "title": "Music  &  Theater   Night",
        "venue_name": "Aviemore Arts Center",
        "date_start": datetime(2026, 12, 5),
        "event_id": "a95b50d3-c355-495b-8ec0-94b56011e9ca",
        "description": "Multiple consecutive spaces and special characters"
    },
    {
        "title": "Rock-Fest-2027-",
        "venue_name": "Inverness Arena",
        "date_start": datetime(2027, 7, 24),
        "event_id": "c35550d3-a635-495b-8ec0-94b56011e9ca",
        "description": "Trailing hyphens"
    },
    {
        "title": "Fèis Rois Ceilidh Trail (with accents)",
        "venue_name": "Ullapool Village Hall",
        "date_start": datetime(2026, 8, 1),
        "event_id": "8ec094b5-c355-495b-8ec0-94b56011e9ca",
        "description": "Accents and parentheses"
    },
    {
        "title": "Highland Games",
        "venue_name": "Bught Park, Inverness",
        "date_start": datetime(2027, 8, 12),
        "event_id": "f4caa6cf-c355-495b-8ec0-94b56011e9ca",
        "description": "Duplicate Title 1 in the same month"
    },
    {
        "title": "Highland Games",
        "venue_name": "Bught Park, Inverness",
        "date_start": datetime(2027, 8, 19),
        "event_id": "a2pDwrk7-c355-495b-8ec0-94b56011e9ca",
        "description": "Duplicate Title 2 in the same month (Unique check)"
    }
]

print("=== START SLUG GENERATION SIMULATION ===")
for i, event in enumerate(mock_events, 1):
    slug = generate_event_slug(
        title=event["title"],
        venue_name=event["venue_name"],
        date_start=event["date_start"],
        event_id=event["event_id"]
    )
    print(f"\nTest Case {i}: {event['description']}")
    print(f"  Title: '{event['title']}'")
    print(f"  Venue: '{event['venue_name']}'")
    print(f"  Date:  {event['date_start'].strftime('%Y-%m-%d')}")
    print(f"  UUID:  {event['event_id']}")
    print(f"  --> Resulting Slug: '{slug}'")
print("\n=== END SIMULATION ===")
