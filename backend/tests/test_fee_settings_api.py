import pytest
from uuid import uuid4
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.platform_settings import PlatformSettings
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

def test_admin_fee_settings_endpoints(test_db: Session):
    admin_user = User(
        id=normalize_uuid(str(uuid4())),
        email="admin@highlandevents.co.uk",
        username="superadmin",
        is_admin=True,
    )
    test_db.add(admin_user)
    test_db.commit()

    def get_session_override():
        return test_db

    def get_current_user_override():
        return admin_user

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user] = get_current_user_override
    client = TestClient(app)

    try:
        # 1. GET default fee settings
        res = client.get("/api/admin/ticketing/settings")
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["base_percentage"] == 3.5
        assert data["base_flat_fee"] == 0.30
        assert data["hard_cap_amount"] == 75.00

        # 2. PUT updated fee settings
        update_payload = {
            "base_percentage": 4.25,
            "base_flat_fee": 0.45,
            "hard_cap_amount": 100.00
        }
        put_res = client.put("/api/admin/ticketing/settings", json=update_payload)
        assert put_res.status_code == 200, put_res.text
        updated_data = put_res.json()
        assert updated_data["base_percentage"] == 4.25
        assert updated_data["base_flat_fee"] == 0.45
        assert updated_data["hard_cap_amount"] == 100.00

        # 3. GET to verify persistence
        get_again = client.get("/api/admin/ticketing/settings")
        assert get_again.status_code == 200
        persisted = get_again.json()
        assert persisted["base_percentage"] == 4.25
        assert persisted["base_flat_fee"] == 0.45
        assert persisted["hard_cap_amount"] == 100.00

    finally:
        app.dependency_overrides.clear()
