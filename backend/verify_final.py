from fastapi.testclient import TestClient
from sqlmodel import Session, select
from app.main import app
from app.core.database import engine
from app.models.user import User
from app.models.event import Event
from app.core.security import get_current_user, get_current_user_optional

client = TestClient(app)

with Session(engine) as session:
    user = session.exec(select(User).limit(1)).first()
    event = session.exec(select(Event).limit(1)).first()
    
if not user or not event:
    print("No user or event")
else:
    # Mock auth
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_current_user_optional] = lambda: user
    
    # 1. Attend
    print("ATTENDING...")
    response = client.post(f"/api/events/{event.id}/attend")
    print("Toggle Response:", response.json().get('is_attending'))
    
    # 2. Get event and check is_attending
    print("FETCHING EVENT...")
    get_response = client.get(f"/api/events/{event.id}")
    data = get_response.json()
    print("Is Attending in response:", data.get('is_attending'))
    print("Attending Count in response:", data.get('attending_count'))
    
    # Clean up (Unattend)
    client.post(f"/api/events/{event.id}/attend")
