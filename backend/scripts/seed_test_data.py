#!/usr/bin/env python3
"""
Test Data Seeder for Highland Events Hub
=========================================

Creates test data for QA and development purposes.
IDEMPOTENT: Safe to run multiple times - checks before creating.

Usage:
    cd backend
    python scripts/seed_test_data.py

Environment:
    DATABASE_URL must be set (or .env file present)
"""
import os
import sys
from datetime import datetime, timedelta
from uuid import uuid4

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from sqlalchemy import create_engine

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User
from app.models.venue import Venue
from app.models.event import Event
from app.models.category import Category
from app.models.tag import Tag, EventTag
from app.models.event_participating_venue import EventParticipatingVenue

# ============================================================
# CONFIG
# ============================================================

TEST_PREFIX = "[TEST]"
DEFAULT_PASSWORD_HASH = hash_password("password123")

# Test user definitions
TEST_USERS = [
    {
        "email": "trusted@test.com",
        "username": "trusted_admin",
        "display_name": "Trusted Admin User",
        "is_admin": True,
        "is_trusted_organizer": True,
        "trust_level": 10,
    },
    {
        "email": "newbie@test.com",
        "username": "newbie_user",
        "display_name": "Newbie User",
        "is_admin": False,
        "is_trusted_organizer": False,
        "trust_level": 0,
    },
    {
        "email": "banned@test.com",
        "username": "banned_user",
        "display_name": "Banned User",
        "is_admin": False,
        "is_trusted_organizer": False,
        "trust_level": 0,
        # Note: No "is_active" field in User model, but we mark via display_name
    },
]

# Test categories to ensure exist
TEST_CATEGORIES = ["Music", "Theatre", "Comedy", "Sports", "Markets"]

# Test venues
TEST_VENUES = [
    {
        "name": f"{TEST_PREFIX} The Noisy Pub",
        "address": "123 High Street, Inverness, IV1 1AA",
        "latitude": 57.4778,
        "longitude": -4.2247,
        "postcode": "IV1 1AA",
    },
    {
        "name": f"{TEST_PREFIX} The Silent Library",
        "address": "456 Academy Street, Inverness, IV1 1LP",
        "latitude": 57.4792,
        "longitude": -4.2231,
        "postcode": "IV1 1LP",
    },
    {
        "name": f"{TEST_PREFIX} The Secret Field",
        "address": None,  # No address, just coords
        "latitude": 57.4650,
        "longitude": -4.2100,
        "postcode": None,
    },
]


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def get_or_create_user(session: Session, user_data: dict) -> User:
    """Get existing user by email or create new one."""
    existing = session.exec(
        select(User).where(User.email == user_data["email"])
    ).first()
    
    if existing:
        print(f"  ⏭️  User exists: {user_data['email']}")
        return existing
    
    user = User(
        id=str(uuid4()).replace("-", ""),
        email=user_data["email"],
        username=user_data["username"],
        display_name=user_data["display_name"],
        password_hash=DEFAULT_PASSWORD_HASH,
        is_admin=user_data.get("is_admin", False),
        is_trusted_organizer=user_data.get("is_trusted_organizer", False),
        trust_level=user_data.get("trust_level", 0),
    )
    session.add(user)
    session.flush()
    print(f"  ✅ Created User: {user_data['email']}")
    return user


def get_or_create_category(session: Session, name: str) -> Category:
    """Get existing category by name or create new one."""
    existing = session.exec(
        select(Category).where(Category.name == name)
    ).first()
    
    if existing:
        return existing
    
    category = Category(
        id=str(uuid4()).replace("-", ""),
        name=name,
        slug=name.lower().replace(" ", "-"),
        description=f"Test category: {name}",
        icon="🎵" if name == "Music" else "🎭" if name == "Theatre" else "🎪",
    )
    session.add(category)
    session.flush()
    print(f"  ✅ Created Category: {name}")
    return category


def get_or_create_venue(session: Session, venue_data: dict, owner_id: str) -> Venue:
    """Get existing venue by name or create new one."""
    existing = session.exec(
        select(Venue).where(Venue.name == venue_data["name"])
    ).first()
    
    if existing:
        print(f"  ⏭️  Venue exists: {venue_data['name']}")
        return existing
    
    from app.services.geolocation import calculate_geohash
    
    venue = Venue(
        id=str(uuid4()).replace("-", ""),
        name=venue_data["name"],
        address=venue_data.get("address"),
        latitude=venue_data["latitude"],
        longitude=venue_data["longitude"],
        geohash=calculate_geohash(venue_data["latitude"], venue_data["longitude"]),
        postcode=venue_data.get("postcode"),
        owner_id=owner_id,
    )
    session.add(venue)
    session.flush()
    print(f"  ✅ Created Venue: {venue_data['name']}")
    return venue


def get_or_create_event(
    session: Session,
    title: str,
    description: str,
    organizer_id: str,
    category_id: str,
    venue_id: str = None,
    location_name: str = None,
    latitude: float = None,
    longitude: float = None,
    date_start: datetime = None,
    date_end: datetime = None,
    image_url: str = None,
    status: str = "published",
) -> Event:
    """Get existing event by title or create new one."""
    existing = session.exec(
        select(Event).where(Event.title == title)
    ).first()
    
    if existing:
        print(f"  ⏭️  Event exists: {title}")
        return existing
    
    from app.services.geolocation import calculate_geohash
    
    # Default to next week if no date provided
    if date_start is None:
        date_start = datetime.utcnow() + timedelta(days=7)
    if date_end is None:
        date_end = date_start + timedelta(hours=3)
    
    geohash = None
    if latitude and longitude:
        geohash = calculate_geohash(latitude, longitude)
    
    event = Event(
        id=str(uuid4()).replace("-", ""),
        title=title,
        description=description,
        date_start=date_start,
        date_end=date_end,
        venue_id=venue_id,
        location_name=location_name,
        latitude=latitude,
        longitude=longitude,
        geohash=geohash,
        category_id=category_id,
        organizer_id=organizer_id,
        image_url=image_url,
        status=status,
    )
    session.add(event)
    session.flush()
    print(f"  ✅ Created Event: {title[:50]}{'...' if len(title) > 50 else ''}")
    return event


def link_participating_venue(session: Session, event_id: str, venue_id: str):
    """Link a venue as participating in an event."""
    existing = session.exec(
        select(EventParticipatingVenue).where(
            EventParticipatingVenue.event_id == event_id,
            EventParticipatingVenue.venue_id == venue_id
        )
    ).first()
    
    if existing:
        return
    
    link = EventParticipatingVenue(event_id=event_id, venue_id=venue_id)
    session.add(link)


# ============================================================
# MAIN SEEDER
# ============================================================

def seed_test_data():
    """Main seeding function."""
    print("\n" + "=" * 60)
    print("🌱 HIGHLAND EVENTS HUB - TEST DATA SEEDER")
    print("=" * 60)
    
    # Create engine from settings
    engine = create_engine(str(settings.DATABASE_URL))
    
    with Session(engine) as session:
        # --------------------------------------------------------
        # STEP 1: Create Test Users
        # --------------------------------------------------------
        print("\n📋 Step 1: Creating Test Users...")
        users = {}
        for user_data in TEST_USERS:
            user = get_or_create_user(session, user_data)
            users[user_data["email"]] = user
        
        trusted_user = users["trusted@test.com"]
        newbie_user = users["newbie@test.com"]
        
        # --------------------------------------------------------
        # STEP 2: Ensure Categories Exist
        # --------------------------------------------------------
        print("\n📋 Step 2: Ensuring Categories Exist...")
        categories = {}
        for cat_name in TEST_CATEGORIES:
            cat = get_or_create_category(session, cat_name)
            categories[cat_name] = cat
        
        # --------------------------------------------------------
        # STEP 3: Create Test Venues
        # --------------------------------------------------------
        print("\n📋 Step 3: Creating Test Venues...")
        venues = {}
        for venue_data in TEST_VENUES:
            venue = get_or_create_venue(session, venue_data, trusted_user.id)
            venues[venue_data["name"]] = venue
        
        noisy_pub = venues[f"{TEST_PREFIX} The Noisy Pub"]
        silent_library = venues[f"{TEST_PREFIX} The Silent Library"]
        secret_field = venues[f"{TEST_PREFIX} The Secret Field"]
        
        # --------------------------------------------------------
        # STEP 4: Create Test Events
        # --------------------------------------------------------
        print("\n📋 Step 4: Creating Test Events...")
        
        # Event 1: Standard event
        event1 = get_or_create_event(
            session,
            title=f"{TEST_PREFIX} Next Week's Gig",
            description="A fantastic live music event featuring local bands.",
            organizer_id=trusted_user.id,
            category_id=categories["Music"].id,
            venue_id=noisy_pub.id,
            latitude=noisy_pub.latitude,
            longitude=noisy_pub.longitude,
            image_url="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800",
        )
        
        # Event 2: Visual stress test (long title/description)
        long_title = f"{TEST_PREFIX} " + "This Is An Extremely Long Event Title That Tests UI Truncation and Layout Boundaries " * 2
        long_description = "This is a stress test event with an extremely long description. " * 50
        
        event2 = get_or_create_event(
            session,
            title=long_title[:250],  # Truncate to fit
            description=long_description[:4500],
            organizer_id=trusted_user.id,
            category_id=categories["Theatre"].id,
            venue_id=silent_library.id,
            latitude=silent_library.latitude,
            longitude=silent_library.longitude,
        )
        
        # Event 3: Headless event (no venue, custom location)
        event3 = get_or_create_event(
            session,
            title=f"{TEST_PREFIX} City Center Crawl",
            description="A walking tour of multiple venues in the city center. No single venue!",
            organizer_id=trusted_user.id,
            category_id=categories["Comedy"].id,
            venue_id=None,  # No venue!
            location_name="Inverness City Center",
            latitude=57.4780,
            longitude=-4.2240,
        )
        
        # Link participating venues to the headless event
        link_participating_venue(session, event3.id, noisy_pub.id)
        link_participating_venue(session, event3.id, silent_library.id)
        print(f"    ↳ Linked participating venues to City Center Crawl")
        
        # Event 4: No image (tests UI fallback)
        event4 = get_or_create_event(
            session,
            title=f"{TEST_PREFIX} Mystery Event (No Image)",
            description="This event has no cover image. The UI should show a fallback.",
            organizer_id=newbie_user.id,
            category_id=categories["Markets"].id,
            venue_id=secret_field.id,
            latitude=secret_field.latitude,
            longitude=secret_field.longitude,
            image_url=None,  # Explicitly no image
        )
        
        # Event 5: Past event (should not show in "upcoming")
        past_date = datetime.utcnow() - timedelta(days=30)
        event5 = get_or_create_event(
            session,
            title=f"{TEST_PREFIX} Past Event (30 Days Ago)",
            description="This event already happened. It should NOT appear in upcoming listings.",
            organizer_id=trusted_user.id,
            category_id=categories["Sports"].id,
            venue_id=noisy_pub.id,
            latitude=noisy_pub.latitude,
            longitude=noisy_pub.longitude,
            date_start=past_date,
            date_end=past_date + timedelta(hours=2),
            status="published",
        )
        
        # --------------------------------------------------------
        # COMMIT
        # --------------------------------------------------------
        session.commit()
        
        print("\n" + "=" * 60)
        print("✅ TEST DATA SEEDING COMPLETE!")
        print("=" * 60)
        print(f"\n📊 Summary:")
        print(f"   • Users created/verified: {len(TEST_USERS)}")
        print(f"   • Categories ensured: {len(TEST_CATEGORIES)}")
        print(f"   • Venues created/verified: {len(TEST_VENUES)}")
        print(f"   • Events created/verified: 5")
        print(f"\n🔑 Test Login Credentials:")
        print(f"   • trusted@test.com / password123 (Admin, Trust Level 10)")
        print(f"   • newbie@test.com / password123 (Regular User)")
        print(f"   • banned@test.com / password123 (Banned User)")
        print("\n")


if __name__ == "__main__":
    seed_test_data()
