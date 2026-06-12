from fastapi.testclient import TestClient
from sqlmodel import Session, select
from app.main import app
from app.core.database import engine
from app.models.user import User
from app.models.event import Event
from app.core.security import get_current_user

client = TestClient(app)

with Session(engine) as session:
    user = session.exec(select(User).limit(1)).first()
    event = session.exec(select(Event).limit(1)).first()
    
if not user or not event:
    print("No user or event")
else:
    # We need to mock get_current_user dependency
    app.dependency_overrides = {}
    app.dependency_overrides[get_current_user] = lambda: user
    
    response = client.post(f"/api/events/{event.id}/attend")
    print("STATUS:", response.status_code)
    print("RESPONSE:", response.json())
