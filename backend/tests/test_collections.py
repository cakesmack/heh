import pytest
from uuid import uuid4
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.collection import Collection
from app.core.utils import normalize_uuid

from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

@pytest.fixture(name="test_db")
def test_db_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

def test_collection_enable_venue_filter(test_db: Session):
    admin_user = User(
        id=normalize_uuid(str(uuid4())),
        email="admin@highlandevents.co.uk",
        username="coladmin",
        is_admin=True,
    )
    test_db.add(admin_user)
    test_db.commit()

    def get_session_override():
        return test_db

    def get_current_admin_override():
        return admin_user

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user] = get_current_admin_override

    client = TestClient(app)

    try:
        # 1. Create collection with enable_venue_filter = True
        create_payload = {
            "title": "Highland Festival",
            "subtitle": "Multi-venue festival",
            "target_link": "/collections/highland-festival",
            "slug": "highland-festival",
            "is_active": True,
            "enable_venue_filter": True,
        }
        res = client.post("/api/collections", json=create_payload)
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["title"] == "Highland Festival"
        assert data["enable_venue_filter"] is True
        col_id = data["id"]

        # 2. Fetch by slug (public endpoint)
        res_slug = client.get("/api/collections/slug/highland-festival")
        assert res_slug.status_code == 200
        slug_data = res_slug.json()
        assert slug_data["enable_venue_filter"] is True

        # 3. Update collection to disable venue filter
        update_payload = {
            "enable_venue_filter": False,
        }
        res_upd = client.put(f"/api/collections/{col_id}", json=update_payload)
        assert res_upd.status_code == 200
        upd_data = res_upd.json()
        assert upd_data["enable_venue_filter"] is False

        # 4. Verify slug endpoint now reflects false
        res_slug2 = client.get("/api/collections/slug/highland-festival")
        assert res_slug2.status_code == 200
        assert res_slug2.json()["enable_venue_filter"] is False

    finally:
        app.dependency_overrides.clear()


def test_collection_organizer_profile_ids_filter(test_db: Session):
    from datetime import datetime, timezone, timedelta
    from app.models.event import Event

    admin_user = User(
        id=normalize_uuid(str(uuid4())),
        email="admin2@highlandevents.co.uk",
        username="orgfilteradmin",
        is_admin=True,
    )
    test_db.add(admin_user)

    org_id_1 = normalize_uuid(str(uuid4()))
    org_id_2 = normalize_uuid(str(uuid4()))
    org_id_other = normalize_uuid(str(uuid4()))

    # Create future events for org_1, org_2, and org_other
    now = datetime.now(timezone.utc)
    future_start = now + timedelta(days=2)
    future_end = now + timedelta(days=2, hours=3)
    ev1 = Event(
        id=normalize_uuid(str(uuid4())),
        title="Org 1 Gala",
        slug="org-1-gala",
        date_start=future_start,
        date_end=future_end,
        organizer_id=admin_user.id,
        organizer_profile_id=org_id_1,
        status="published",
    )
    ev2 = Event(
        id=normalize_uuid(str(uuid4())),
        title="Org 2 Showcase",
        slug="org-2-showcase",
        date_start=future_start,
        date_end=future_end,
        organizer_id=admin_user.id,
        organizer_profile_id=org_id_2,
        status="published",
    )
    ev3 = Event(
        id=normalize_uuid(str(uuid4())),
        title="Other Event",
        slug="other-event",
        date_start=future_start,
        date_end=future_end,
        organizer_id=admin_user.id,
        organizer_profile_id=org_id_other,
        status="published",
    )
    test_db.add(ev1)
    test_db.add(ev2)
    test_db.add(ev3)
    test_db.commit()

    def get_session_override():
        return test_db

    def get_current_admin_override():
        return admin_user

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user] = get_current_admin_override

    client = TestClient(app)

    try:
        # 1. Create collection with organizer_profile_ids
        create_payload = {
            "title": "Selected Organizers Series",
            "target_link": "/collections/selected-organizers",
            "slug": "selected-organizers",
            "is_active": True,
            "organizer_profile_ids": [org_id_1, org_id_2],
        }
        res = client.post("/api/collections", json=create_payload)
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["organizer_profile_ids"] == [org_id_1, org_id_2]
        col_id = data["id"]

        # 2. Query public collection slug endpoint
        res_slug = client.get("/api/collections/slug/selected-organizers")
        assert res_slug.status_code == 200
        assert res_slug.json()["organizer_profile_ids"] == [org_id_1, org_id_2]

        # 3. Query collection events endpoint
        res_col_events = client.get("/api/collections/slug/selected-organizers/events")
        assert res_col_events.status_code == 200
        col_events = res_col_events.json()["events"]
        event_titles = [e["title"] for e in col_events]
        assert "Org 1 Gala" in event_titles
        assert "Org 2 Showcase" in event_titles
        assert "Other Event" not in event_titles

        # 4. Query /api/events with organizer_profile_ids parameter
        res_events = client.get(f"/api/events?organizer_profile_ids={org_id_1},{org_id_2}")
        assert res_events.status_code == 200
        events_list = res_events.json()["events"]
        filtered_titles = [e["title"] for e in events_list]
        assert "Org 1 Gala" in filtered_titles
        assert "Org 2 Showcase" in filtered_titles
        assert "Other Event" not in filtered_titles

        # 5. Update collection to null/clear organizer_profile_ids
        res_upd = client.put(f"/api/collections/{col_id}", json={"organizer_profile_ids": None})
        assert res_upd.status_code == 200
        assert res_upd.json()["organizer_profile_ids"] is None

    finally:
        app.dependency_overrides.clear()


def test_collection_organizer_profile_ids_strict_and_isolation(test_db: Session):
    """
    Verify that organizer_profile_ids acts as a strict, absolute boundary (AND condition)
    and is never bypassed by flexible OR conditions (categories/keywords).
    """
    from datetime import datetime, timezone, timedelta
    from app.models.event import Event
    from app.models.category import Category

    admin_user = User(
        id=normalize_uuid(str(uuid4())),
        email="admin_strict@highlandevents.co.uk",
        username="strictadmin",
        is_admin=True,
    )
    test_db.add(admin_user)

    cat_music = Category(
        id=normalize_uuid(str(uuid4())),
        name="Music",
        slug="music",
    )
    cat_art = Category(
        id=normalize_uuid(str(uuid4())),
        name="Art",
        slug="art",
    )
    test_db.add(cat_music)
    test_db.add(cat_art)

    org_target = normalize_uuid(str(uuid4()))
    org_leak = normalize_uuid(str(uuid4()))

    now = datetime.now(timezone.utc)
    future_start = now + timedelta(days=2)
    future_end = now + timedelta(days=2, hours=3)

    # Event 1: Target organizer + Music category (Matches both organizer and category in OR)
    ev_target_music = Event(
        id=normalize_uuid(str(uuid4())),
        title="Target Music Concert",
        slug="target-music-concert",
        date_start=future_start,
        date_end=future_end,
        organizer_id=admin_user.id,
        organizer_profile_id=org_target,
        category_id=cat_music.id,
        status="published",
    )
    # Event 2: Target organizer + Art category with Acoustic keyword (Matches organizer and keyword in OR)
    ev_target_keyword = Event(
        id=normalize_uuid(str(uuid4())),
        title="Target Acoustic Workshop",
        slug="target-acoustic-workshop",
        date_start=future_start,
        date_end=future_end,
        organizer_id=admin_user.id,
        organizer_profile_id=org_target,
        category_id=cat_art.id,
        status="published",
    )
    # Event 3: Unrelated organizer + Music category (Must not leak even though category matches Music in OR)
    ev_leak_music = Event(
        id=normalize_uuid(str(uuid4())),
        title="Unrelated Music Gala",
        slug="unrelated-music-gala",
        date_start=future_start,
        date_end=future_end,
        organizer_id=admin_user.id,
        organizer_profile_id=org_leak,
        category_id=cat_music.id,
        status="published",
    )
    # Event 4: Unrelated organizer + Acoustic keyword (Must not leak even though keyword matches in OR)
    ev_leak_keyword = Event(
        id=normalize_uuid(str(uuid4())),
        title="Unrelated Acoustic Session",
        slug="unrelated-acoustic-session",
        date_start=future_start,
        date_end=future_end,
        organizer_id=admin_user.id,
        organizer_profile_id=org_leak,
        category_id=cat_art.id,
        status="published",
    )

    test_db.add(ev_target_music)
    test_db.add(ev_target_keyword)
    test_db.add(ev_leak_music)
    test_db.add(ev_leak_keyword)
    test_db.commit()

    def get_session_override():
        return test_db

    def get_current_admin_override():
        return admin_user

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user] = get_current_admin_override

    client = TestClient(app)

    try:
        # Create a collection with target organizer, Music category, and Acoustic keyword in OR mode
        create_payload = {
            "title": "Strict Target Collection",
            "target_link": "/collections/strict-target",
            "slug": "strict-target",
            "is_active": True,
            "organizer_profile_ids": [org_target],
            "filter_params": {
                "category_ids": [cat_music.id],
                "q": "Acoustic",
                "combine_operator": "or",
            },
        }
        res = client.post("/api/collections", json=create_payload)
        assert res.status_code == 201, res.text

        # Query collection events
        res_events = client.get("/api/collections/slug/strict-target/events")
        assert res_events.status_code == 200, res_events.text
        data = res_events.json()
        titles = [e["title"] for e in data["events"]]

        # Both target events must be returned
        assert "Target Music Concert" in titles
        assert "Target Acoustic Workshop" in titles

        # No leakage from unrelated organizer
        assert "Unrelated Music Gala" not in titles
        assert "Unrelated Acoustic Session" not in titles
        assert len(titles) == 2

    finally:
        app.dependency_overrides.clear()


def test_api_events_organizer_profile_ids_strict_isolation(test_db: Session):
    """
    Test that GET /api/events with organizer_profile_ids and search keyword 'nc500'
    strictly enforces the organizer boundary with zero leakage from other organizers.
    Tests both hyphenated and unhyphenated UUID formats.
    """
    from datetime import datetime, timezone, timedelta
    from app.models.event import Event
    from app.models.organizer import Organizer

    now = datetime.now(timezone.utc)
    future_start = now + timedelta(days=3)
    future_end = now + timedelta(days=3, hours=2)

    admin_user = User(
        id=normalize_uuid(str(uuid4())),
        email="venturenorth@highlandevents.co.uk",
        username="venturenorthadmin",
        is_admin=True,
    )
    test_db.add(admin_user)
    test_db.commit()

    # Create target organizer (e.g. Venture North) and unrelated organizer
    raw_target_uuid = str(uuid4()) # with hyphens
    target_org = Organizer(
        id=normalize_uuid(raw_target_uuid),
        name="Venture North",
        slug="venture-north",
        user_id=admin_user.id,
    )
    unrelated_org = Organizer(
        id=normalize_uuid(str(uuid4())),
        name="Other Operator",
        slug="other-operator",
        user_id=admin_user.id,
    )
    test_db.add(target_org)
    test_db.add(unrelated_org)
    test_db.commit()

    # Event 1: Belongs to Venture North with nc500 in title
    ev_target_nc500 = Event(
        id=normalize_uuid(str(uuid4())),
        title="Venture North NC500 Tour",
        slug="vn-nc500-tour",
        date_start=future_start,
        date_end=future_end,
        organizer_id=admin_user.id,
        organizer_profile_id=target_org.id,
        status="published",
    )
    # Event 2: Belongs to other organizer with nc500 in description (leaker candidate)
    ev_other_nc500 = Event(
        id=normalize_uuid(str(uuid4())),
        title="Rival NC500 Drive",
        slug="rival-nc500-drive",
        description="Experience the NC500 with another tour guide",
        date_start=future_start,
        date_end=future_end,
        organizer_id=admin_user.id,
        organizer_profile_id=unrelated_org.id,
        status="published",
    )
    # Event 3: Belongs to Venture North without nc500 keyword
    ev_target_other = Event(
        id=normalize_uuid(str(uuid4())),
        title="Venture North Local Hike",
        slug="vn-local-hike",
        date_start=future_start,
        date_end=future_end,
        organizer_id=admin_user.id,
        organizer_profile_id=target_org.id,
        status="published",
    )

    test_db.add(ev_target_nc500)
    test_db.add(ev_other_nc500)
    test_db.add(ev_target_other)
    test_db.commit()

    def get_session_override():
        return test_db

    app.dependency_overrides[get_session] = get_session_override

    client = TestClient(app)

    try:
        # 1. Query GET /api/events with hyphenated UUID in organizer_profile_ids and q=nc500
        res = client.get(
            f"/api/events?organizer_profile_ids={raw_target_uuid}&q=nc500&combine_operator=and"
        )
        assert res.status_code == 200, res.text
        data = res.json()
        returned_titles = [e["title"] for e in data["events"]]

        # Target event must be present
        assert "Venture North NC500 Tour" in returned_titles
        # Rival event matching 'nc500' must NOT leak
        assert "Rival NC500 Drive" not in returned_titles
        # Non-matching keyword event from target organizer must not be present in AND mode
        assert "Venture North Local Hike" not in returned_titles
        assert len(returned_titles) == 1

        # 2. Query GET /api/events with unhyphenated UUID in organizer_profile_ids
        res2 = client.get(
            f"/api/events?organizer_profile_ids={target_org.id}&q=nc500&combine_operator=and"
        )
        assert res2.status_code == 200, res2.text
        data2 = res2.json()
        returned_titles2 = [e["title"] for e in data2["events"]]
        assert "Venture North NC500 Tour" in returned_titles2
        assert "Rival NC500 Drive" not in returned_titles2
        assert len(returned_titles2) == 1
    finally:
        app.dependency_overrides.clear()


def test_collection_slug_uniqueness_and_error_handling(test_db: Session):
    """
    Test that duplicate collection slugs are rejected with clean HTTP 400 Bad Request
    errors on both creation and update, preventing 500 UniqueViolation errors.
    """
    admin_user = User(
        id=normalize_uuid(str(uuid4())),
        email="slugadmin@highlandevents.co.uk",
        username="slugadmin",
        is_admin=True,
    )
    test_db.add(admin_user)
    test_db.commit()

    def get_session_override():
        return test_db

    def get_current_admin_override():
        return admin_user

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user] = get_current_admin_override

    client = TestClient(app)

    try:
        # 1. Create first collection
        payload1 = {
            "title": "Inverness Fringe Festival",
            "target_link": "/collections/inverness-fringe-festival",
            "slug": "inverness-fringe-festival",
            "is_active": True,
        }
        res1 = client.post("/api/collections", json=payload1)
        assert res1.status_code == 201, res1.text
        col1_id = res1.json()["id"]

        # 2. Attempt to create duplicate collection with the same slug -> Must return 400, not 500
        payload2 = {
            "title": "Inverness Fringe Festival Duplicate",
            "target_link": "/collections/inverness-fringe-festival",
            "slug": "inverness-fringe-festival",
            "is_active": True,
        }
        res2 = client.post("/api/collections", json=payload2)
        assert res2.status_code == 400, res2.text
        assert "already exists" in res2.json()["detail"]

        # 3. Create second collection with distinct slug
        payload3 = {
            "title": "Inverness Fringe 2026",
            "target_link": "/collections/inverness-fringe-2026",
            "slug": "inverness-fringe-2026",
            "is_active": True,
        }
        res3 = client.post("/api/collections", json=payload3)
        assert res3.status_code == 201, res3.text
        col2_id = res3.json()["id"]

        # 4. Updating col1 with its existing slug must succeed
        update_col1 = {
            "title": "Inverness Fringe Festival Updated",
            "slug": "inverness-fringe-festival",
        }
        res4 = client.put(f"/api/collections/{col1_id}", json=update_col1)
        assert res4.status_code == 200, res4.text
        assert res4.json()["title"] == "Inverness Fringe Festival Updated"

        # 5. Updating col2 to col1's slug must be rejected with 400
        update_col2_dup = {
            "slug": "inverness-fringe-festival",
        }
        res5 = client.put(f"/api/collections/{col2_id}", json=update_col2_dup)
        assert res5.status_code == 400, res5.text
        assert "already exists" in res5.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_list_collections_include_inactive(test_db: Session):
    """
    Test that GET /api/collections excludes inactive collections by default
    for public display, but includes them when include_inactive=True for admin management.
    """
    active_col = Collection(
        title="Active Fest",
        target_link="/collections/active-fest",
        slug="active-fest",
        is_active=True,
    )
    inactive_col = Collection(
        title="Inactive Fest",
        target_link="/collections/inactive-fest",
        slug="inactive-fest",
        is_active=False,
    )
    test_db.add(active_col)
    test_db.add(inactive_col)
    test_db.commit()

    def get_session_override():
        return test_db

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)

    try:
        # 1. Default list (public): only active collections
        res_public = client.get("/api/collections")
        assert res_public.status_code == 200
        public_slugs = [c["slug"] for c in res_public.json()]
        assert "active-fest" in public_slugs
        assert "inactive-fest" not in public_slugs

        # 2. Admin list with include_inactive=true: both active and inactive
        res_admin = client.get("/api/collections?include_inactive=true")
        assert res_admin.status_code == 200
        admin_slugs = [c["slug"] for c in res_admin.json()]
        assert "active-fest" in admin_slugs
        assert "inactive-fest" in admin_slugs
    finally:
        app.dependency_overrides.clear()


def test_collection_slug_returns_preaggregated_venues(test_db: Session):
    """
    Test that GET /api/collections/slug/{slug} returns pre-aggregated venues
    and total_venue_count covering primary venues, participating venues,
    and unlinked location names for published collection events.
    """
    from datetime import datetime, timezone, timedelta
    from app.models.venue import Venue
    from app.models.event import Event
    from app.models.event_participating_venue import EventParticipatingVenue

    now = datetime.now(timezone.utc)

    # 1. Create venues
    venue_a = Venue(
        id=normalize_uuid(str(uuid4())),
        name="Alpha Theatre",
        address="1 Alpha St",
        latitude=57.47,
        longitude=-4.22,
        slug="alpha-theatre",
        city="Inverness"
    )
    venue_b = Venue(
        id=normalize_uuid(str(uuid4())),
        name="Beta Hall",
        address="2 Beta St",
        latitude=57.48,
        longitude=-4.23,
        slug="beta-hall",
        city="Inverness"
    )
    venue_c = Venue(
        id=normalize_uuid(str(uuid4())),
        name="Gamma Arts Centre",
        address="3 Gamma St",
        latitude=57.49,
        longitude=-4.24,
        slug="gamma-arts-centre",
        city="Aviemore"
    )
    unrelated_venue = Venue(
        id=normalize_uuid(str(uuid4())),
        name="Zeta Unrelated Venue",
        address="99 Zeta St",
        latitude=57.50,
        longitude=-4.25,
        slug="zeta-unrelated-venue",
        city="Thurso"
    )
    test_db.add(venue_a)
    test_db.add(venue_b)
    test_db.add(venue_c)
    test_db.add(unrelated_venue)
    test_db.commit()

    # 2. Create collection
    col = Collection(
        title="Inverness Festival",
        target_link="/collections/inverness-festival",
        slug="inverness-festival",
        is_active=True,
        enable_venue_filter=True,
        filter_params={"q": "Festival"}
    )
    test_db.add(col)
    test_db.commit()

    # 3. Create published events matching collection keyword "Festival"
    ev1 = Event(
        id=normalize_uuid(str(uuid4())),
        title="Festival Opening Concert",
        status="published",
        date_start=now + timedelta(days=1),
        date_end=now + timedelta(days=1, hours=3),
        venue_id=venue_a.id,
    )
    ev2 = Event(
        id=normalize_uuid(str(uuid4())),
        title="Festival Comedy Night",
        status="published",
        date_start=now + timedelta(days=2),
        date_end=now + timedelta(days=2, hours=3),
        venue_id=venue_b.id,
    )
    ev3 = Event(
        id=normalize_uuid(str(uuid4())),
        title="Festival Multi-Venue Crawl",
        status="published",
        date_start=now + timedelta(days=3),
        date_end=now + timedelta(days=3, hours=5),
        venue_id=venue_a.id,
    )
    ev4 = Event(
        id=normalize_uuid(str(uuid4())),
        title="Festival Park Gathering",
        status="published",
        date_start=now + timedelta(days=4),
        date_end=now + timedelta(days=4, hours=2),
        venue_id=None,
        location_name="Bught Park",
    )
    ev5 = Event(
        id=normalize_uuid(str(uuid4())),
        title="Standard Business Meeting",
        status="published",
        date_start=now + timedelta(days=5),
        date_end=now + timedelta(days=5, hours=2),
        venue_id=unrelated_venue.id,
    )
    test_db.add(ev1)
    test_db.add(ev2)
    test_db.add(ev3)
    test_db.add(ev4)
    test_db.add(ev5)
    test_db.commit()

    # Link participating venue for ev3 -> venue_c
    part_link = EventParticipatingVenue(event_id=ev3.id, venue_id=venue_c.id)
    test_db.add(part_link)
    test_db.commit()

    def get_session_override():
        return test_db

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)

    try:
        res = client.get("/api/collections/slug/inverness-festival")
        assert res.status_code == 200, res.text
        data = res.json()

        # Check total_venue_count
        assert data["total_venue_count"] == 4

        # Check venues array
        venues = data["venues"]
        assert len(venues) == 4

        venue_names = [v["name"] for v in venues]
        assert venue_names == ["Alpha Theatre", "Beta Hall", "Bught Park", "Gamma Arts Centre"]
        assert "Zeta Unrelated Venue" not in venue_names
    finally:
        app.dependency_overrides.clear()


def test_collection_track_view_and_click(test_db: Session):
    """
    Test that POST /api/collections/{id_or_slug}/track-view and
    POST /api/collections/{id_or_slug}/track-click atomically increment
    view_count and link_click_count.
    """
    col = Collection(
        title="Tracking Test Collection",
        target_link="/collections/track-test",
        slug="track-test",
        is_active=True,
        view_count=0,
        link_click_count=0,
    )
    test_db.add(col)
    test_db.commit()
    test_db.refresh(col)

    def get_session_override():
        return test_db

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)

    try:
        # 1. Track view by slug (without trailing slash)
        res_view_slug = client.post("/api/collections/track-test/track-view")
        assert res_view_slug.status_code == 200
        assert res_view_slug.json()["status"] == "ok"
        assert res_view_slug.json()["view_count"] == 1

        # 2. Track view by ID (with trailing slash)
        res_view_id = client.post(f"/api/collections/{col.id}/track-view/")
        assert res_view_id.status_code == 200
        assert res_view_id.json()["view_count"] == 2

        # 3. Track link click by slug (without trailing slash)
        res_click_slug = client.post("/api/collections/track-test/track-click")
        assert res_click_slug.status_code == 200
        assert res_click_slug.json()["status"] == "ok"
        assert res_click_slug.json()["link_click_count"] == 1

        # 4. Track link click by ID (with trailing slash)
        res_click_id = client.post(f"/api/collections/{col.id}/track-click/")
        assert res_click_id.status_code == 200
        assert res_click_id.json()["link_click_count"] == 2

        # 5. Verify database and read endpoint serialization
        res_get = client.get("/api/collections/slug/track-test")
        assert res_get.status_code == 200
        data = res_get.json()
        assert data["view_count"] == 2
        assert data["link_click_count"] == 2

        # 6. Verify non-existent returns 404
        res_404 = client.post("/api/collections/non-existent-slug/track-view/")
        assert res_404.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_map_events_strict_organizer_isolation(test_db: Session):
    """
    Verify that interactive map endpoints (/api/events/map and /api/map/events)
    strictly enforce organizer_profile_ids boundary when a collection is selected,
    preventing flexible OR conditions (categories/keywords) from leaking events.
    """
    from datetime import datetime, timezone, timedelta
    from app.models.event import Event
    from app.models.category import Category

    admin_user = User(
        id=normalize_uuid(str(uuid4())),
        email="admin_map@highlandevents.co.uk",
        username="mapadmin",
        is_admin=True,
    )
    test_db.add(admin_user)

    cat_music = Category(
        id=normalize_uuid(str(uuid4())),
        name="Map Music",
        slug="map-music",
    )
    test_db.add(cat_music)

    org_target = normalize_uuid(str(uuid4()))
    org_leak = normalize_uuid(str(uuid4()))

    now = datetime.now(timezone.utc)
    future_start = now + timedelta(days=2)
    future_end = now + timedelta(days=2, hours=3)

    # Event 1: Target organizer (Matches organizer + category in OR)
    ev_target = Event(
        id=normalize_uuid(str(uuid4())),
        title="Target Fringe Concert",
        slug="target-fringe-concert",
        date_start=future_start,
        date_end=future_end,
        organizer_id=admin_user.id,
        organizer_profile_id=org_target,
        category_id=cat_music.id,
        status="published",
        latitude=57.4778,
        longitude=-4.2247,
    )
    # Event 2: Leak organizer (Matches category + keyword in OR, but wrong organizer)
    ev_leak = Event(
        id=normalize_uuid(str(uuid4())),
        title="Leak Fringe Concert",
        slug="leak-fringe-concert",
        description="A Fringe event by another organizer",
        date_start=future_start,
        date_end=future_end,
        organizer_id=admin_user.id,
        organizer_profile_id=org_leak,
        category_id=cat_music.id,
        status="published",
        latitude=57.4778,
        longitude=-4.2247,
    )
    test_db.add(ev_target)
    test_db.add(ev_leak)
    test_db.commit()

    col = Collection(
        title="Strict Map Collection",
        target_link="/collections/strict-map",
        slug="strict-map",
        is_active=True,
        organizer_profile_ids=[org_target],
        filter_params={
            "category": "map-music",
            "q": "Fringe",
            "match_mode": "OR",
        },
    )
    test_db.add(col)
    test_db.commit()
    test_db.refresh(col)

    def get_session_override():
        return test_db

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)

    try:
        # 1. Test /api/events/map with collection_id (int)
        res_map_id = client.get(f"/api/events/map?collection_id={col.id}")
        assert res_map_id.status_code == 200
        event_ids_map_id = [normalize_uuid(e["id"]) for e in res_map_id.json()]
        assert normalize_uuid(ev_target.id) in event_ids_map_id
        assert normalize_uuid(ev_leak.id) not in event_ids_map_id

        # 2. Test /api/events/map with collection slug
        res_map_slug = client.get(f"/api/events/map?collection_id={col.slug}")
        assert res_map_slug.status_code == 200
        event_ids_map_slug = [normalize_uuid(e["id"]) for e in res_map_slug.json()]
        assert normalize_uuid(ev_target.id) in event_ids_map_slug
        assert normalize_uuid(ev_leak.id) not in event_ids_map_slug

        # 3. Test /api/map/events alias endpoint
        res_alias = client.get(f"/api/map/events?collection_id={col.id}")
        assert res_alias.status_code == 200
        event_ids_alias = [normalize_uuid(e["id"]) for e in res_alias.json()]
        assert normalize_uuid(ev_target.id) in event_ids_alias
        assert normalize_uuid(ev_leak.id) not in event_ids_alias

        # 4. Verify exact parity with collection page endpoint
        res_col = client.get(f"/api/collections/slug/{col.slug}/events")
        assert res_col.status_code == 200
        col_event_ids = [normalize_uuid(e["id"]) for e in res_col.json()["events"]]
        assert normalize_uuid(ev_target.id) in col_event_ids
        assert normalize_uuid(ev_leak.id) not in col_event_ids
        assert set(event_ids_map_id) == set(col_event_ids)
    finally:
        app.dependency_overrides.clear()


def test_collection_empty_date_coercion(test_db: Session):
    """
    Verify that empty strings and whitespace for fixed_start_date and fixed_end_date
    are coerced to None without triggering Pydantic validation errors (422),
    and that clearing dates via PUT also cleanly sets them to None.
    """
    admin_user = User(
        id=normalize_uuid(str(uuid4())),
        email="dateadmin@highlandevents.co.uk",
        username="dateadmin",
        is_admin=True,
    )
    test_db.add(admin_user)
    test_db.commit()

    def get_session_override():
        return test_db

    def get_current_admin_override():
        return admin_user

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user] = get_current_admin_override
    client = TestClient(app)

    try:
        # 1. Create collection with empty strings for fixed dates
        payload = {
            "title": "Date Coercion Test",
            "target_link": "/collections/date-coercion-test",
            "slug": "date-coercion-test",
            "is_active": True,
            "fixed_start_date": "",
            "fixed_end_date": "",
        }
        res = client.post("/api/collections", json=payload)
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["fixed_start_date"] is None
        assert data["fixed_end_date"] is None
        col_id = data["id"]

        # 2. Update collection with valid dates
        res_valid = client.put(
            f"/api/collections/{col_id}",
            json={"fixed_start_date": "2026-09-01", "fixed_end_date": "2026-09-05"},
        )
        assert res_valid.status_code == 200, res_valid.text
        valid_data = res_valid.json()
        assert valid_data["fixed_start_date"] == "2026-09-01"
        assert valid_data["fixed_end_date"] == "2026-09-05"

        # 3. Update collection with empty strings to clear dates
        res_clear = client.put(
            f"/api/collections/{col_id}",
            json={"fixed_start_date": "", "fixed_end_date": "   "},
        )
        assert res_clear.status_code == 200, res_clear.text
        cleared_data = res_clear.json()
        assert cleared_data["fixed_start_date"] is None
        assert cleared_data["fixed_end_date"] is None
    finally:
        app.dependency_overrides.clear()


def test_collection_bounding_box_filtering(test_db: Session):
    """
    Verify that geographic bounding box (min_lat, max_lat, min_lng, max_lng)
    filters collection events by venue coordinates with parity across
    feed (/api/collections/{slug}/events), map (/api/events/map), and list (/api/events).
    """
    from datetime import datetime, timezone, timedelta
    from app.models.venue import Venue
    from app.models.event import Event

    admin_user = User(
        id=normalize_uuid(str(uuid4())),
        email="geo_admin@highlandevents.co.uk",
        username="geoadmin",
        is_admin=True,
    )
    test_db.add(admin_user)

    now = datetime.now(timezone.utc)
    future_start = now + timedelta(days=2)
    future_end = now + timedelta(days=2, hours=3)

    # 1. Create venues: one inside NC500 bounding box (Ullapool), one outside (Edinburgh)
    venue_nc500 = Venue(
        id=normalize_uuid(str(uuid4())),
        name="Ullapool Village Hall",
        address="Market St, Ullapool",
        latitude=57.895,
        longitude=-5.160,
        slug="ullapool-village-hall",
        city="Ullapool",
    )
    venue_central = Venue(
        id=normalize_uuid(str(uuid4())),
        name="Edinburgh Assembly Rooms",
        address="George St, Edinburgh",
        latitude=55.953,
        longitude=-3.199,
        slug="edinburgh-assembly-rooms",
        city="Edinburgh",
    )
    test_db.add(venue_nc500)
    test_db.add(venue_central)
    test_db.commit()

    # 2. Create published events linked to both venues
    ev_nc500 = Event(
        id=normalize_uuid(str(uuid4())),
        title="NC500 Coastal Music Fest",
        slug="nc500-coastal-music-fest",
        date_start=future_start,
        date_end=future_end,
        organizer_id=admin_user.id,
        venue_id=venue_nc500.id,
        latitude=57.895,
        longitude=-5.160,
        status="published",
    )
    ev_central = Event(
        id=normalize_uuid(str(uuid4())),
        title="Central Belt Comedy Night",
        slug="central-belt-comedy-night",
        date_start=future_start,
        date_end=future_end,
        organizer_id=admin_user.id,
        venue_id=venue_central.id,
        latitude=55.953,
        longitude=-3.199,
        status="published",
    )
    test_db.add(ev_nc500)
    test_db.add(ev_central)
    test_db.commit()

    def get_session_override():
        return test_db

    def get_current_admin_override():
        return admin_user

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user] = get_current_admin_override
    client = TestClient(app)

    try:
        # 3. Create collection with NC500 bounding box (57.0 <= lat <= 59.0, -6.0 <= lng <= -3.0)
        create_payload = {
            "title": "NC500 Route Events",
            "target_link": "/collections/nc500-route-events",
            "slug": "nc500-route-events",
            "is_active": True,
            "min_lat": 57.0,
            "max_lat": 59.0,
            "min_lng": -6.0,
            "max_lng": -3.0,
        }
        res_create = client.post("/api/collections", json=create_payload)
        assert res_create.status_code == 201, res_create.text
        col_data = res_create.json()
        assert col_data["min_lat"] == 57.0
        assert col_data["max_lat"] == 59.0
        assert col_data["min_lng"] == -6.0
        assert col_data["max_lng"] == -3.0
        col_id = col_data["id"]

        # 4. Verify public slug endpoint returns coordinates
        res_slug = client.get("/api/collections/slug/nc500-route-events")
        assert res_slug.status_code == 200
        assert res_slug.json()["min_lat"] == 57.0

        # 5. Verify collection feed endpoint filters strictly by bounding box
        res_feed = client.get("/api/collections/slug/nc500-route-events/events")
        assert res_feed.status_code == 200
        feed_events = res_feed.json()["events"]
        feed_titles = [e["title"] for e in feed_events]
        assert "NC500 Coastal Music Fest" in feed_titles
        assert "Central Belt Comedy Night" not in feed_titles
        assert len(feed_titles) == 1

        # 6. Verify interactive map endpoint mirrors collection parity
        res_map = client.get(f"/api/events/map?collection_id={col_id}")
        assert res_map.status_code == 200
        map_titles = [e["title"] for e in res_map.json()]
        assert "NC500 Coastal Music Fest" in map_titles
        assert "Central Belt Comedy Night" not in map_titles
        assert len(map_titles) == 1

        # 7. Verify /api/events with collection_id mirrors parity
        res_list = client.get(f"/api/events?collection_id={col_id}")
        assert res_list.status_code == 200
        list_titles = [e["title"] for e in res_list.json()["events"]]
        assert "NC500 Coastal Music Fest" in list_titles
        assert "Central Belt Comedy Night" not in list_titles

        # 8. Clear bounding box via PUT and verify both events return
        res_update = client.put(
            f"/api/collections/{col_id}",
            json={"min_lat": None, "max_lat": None, "min_lng": None, "max_lng": None},
        )
        assert res_update.status_code == 200
        assert res_update.json()["min_lat"] is None

        res_feed_cleared = client.get("/api/collections/slug/nc500-route-events/events")
        assert res_feed_cleared.status_code == 200
        cleared_titles = [e["title"] for e in res_feed_cleared.json()["events"]]
        assert "NC500 Coastal Music Fest" in cleared_titles
        assert "Central Belt Comedy Night" in cleared_titles
        assert len(cleared_titles) == 2
    finally:
        app.dependency_overrides.clear()








