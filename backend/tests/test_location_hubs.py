import pytest
from uuid import uuid4
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.location import Location
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

def test_location_hub_crud_endpoints(test_db: Session):
    admin_user = User(
        id=normalize_uuid(str(uuid4())),
        email="admin@highlandevents.co.uk",
        username="locationadmin",
        is_admin=True,
    )
    regular_user = User(
        id=normalize_uuid(str(uuid4())),
        email="user@highlandevents.co.uk",
        username="regularuser",
        is_admin=False,
    )
    test_db.add(admin_user)
    test_db.add(regular_user)
    test_db.commit()

    def get_session_override():
        return test_db

    def get_current_user_override():
        return admin_user

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user] = get_current_user_override
    client = TestClient(app)

    try:
        # 1. Create a new location hub (Dornoch)
        payload = {
            "name": "Dornoch",
            "slug": "dornoch",
            "seo_meta_title": "Events & Gigs in Dornoch | Highland Events Hub",
            "seo_meta_description": "Explore events, festivals, and music in Dornoch.",
            "hero_image_url": "https://example.com/dornoch.jpg",
            "partner_name": "Visit Dornoch",
            "partner_logo": "https://example.com/dornoch-logo.png",
            "partner_url": "https://visitdornoch.com"
        }
        res = client.post("/api/locations", json=payload)
        assert res.status_code == 201, res.text
        created = res.json()
        assert created["name"] == "Dornoch"
        assert created["slug"] == "dornoch"
        assert created["seo_meta_title"] == payload["seo_meta_title"]
        assert created["partner_name"] == "Visit Dornoch"
        loc_id = created["id"]

        # 2. Prevent duplicate slug
        dup_res = client.post("/api/locations", json={"name": "Dornoch Town", "slug": "dornoch"})
        assert dup_res.status_code == 400
        assert "already exists" in dup_res.json()["detail"]

        # 3. Test auto-slug generation
        auto_res = client.post("/api/locations", json={"name": "Fort Augustus"})
        assert auto_res.status_code == 201
        assert auto_res.json()["slug"] == "fort-augustus"
        auto_id = auto_res.json()["id"]

        # 4. Get by ID
        get_res = client.get(f"/api/locations/{loc_id}")
        assert get_res.status_code == 200
        assert get_res.json()["name"] == "Dornoch"

        # 5. Public feed
        feed_res = client.get("/api/locations/feed/dornoch")
        assert feed_res.status_code == 200
        feed_data = feed_res.json()
        assert feed_data["location_name"] == "Dornoch"
        assert feed_data["location_slug"] == "dornoch"
        assert feed_data["partner_name"] == "Visit Dornoch"

        # 6. Update location
        update_res = client.put(f"/api/locations/{loc_id}", json={
            "seo_meta_title": "Updated Dornoch Title",
            "partner_name": "Experience Dornoch"
        })
        assert update_res.status_code == 200
        assert update_res.json()["seo_meta_title"] == "Updated Dornoch Title"
        assert update_res.json()["partner_name"] == "Experience Dornoch"

        # 7. Non-admin permission check
        app.dependency_overrides[get_current_user] = lambda: regular_user
        forbidden_res = client.post("/api/locations", json={"name": "Golspie"})
        assert forbidden_res.status_code == 403

        # 8. Delete location as admin
        app.dependency_overrides[get_current_user] = get_current_user_override
        del_res = client.delete(f"/api/locations/{auto_id}")
        assert del_res.status_code == 204

        # Verify deletion in DB
        assert test_db.get(Location, auto_id) is None

    finally:
        app.dependency_overrides.clear()
