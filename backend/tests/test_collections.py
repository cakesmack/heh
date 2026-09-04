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



