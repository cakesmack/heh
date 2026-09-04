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
