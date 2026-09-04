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
