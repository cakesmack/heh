import sys
import os
sys.path.append(r'c:\Users\Craig\Desktop\projects\antigrav\heh\highland_events_app\backend')
from app.db.session import engine
from app.models.event import Event
from app.models.user import User
from sqlmodel import Session, select
from app.models.event_attendee import EventAttendee

try:
    with Session(engine) as session:
        user = session.exec(select(User).limit(1)).first()
        event = session.exec(select(Event).limit(1)).first()
        if not user or not event:
            print('No user or event found')
            sys.exit(0)
            
        print(f'Testing with user {user.id} and event {event.id}')
        
        # Test attendee creation
        attendance = EventAttendee(user_id=user.id, event_id=event.id)
        session.add(attendance)
        
        event.attending_count += 1
        session.add(event)
        
        session.commit()
        print('SUCCESS')
        
        # Cleanup
        session.delete(attendance)
        event.attending_count -= 1
        session.add(event)
        session.commit()
except Exception as e:
    print('ERROR:', str(e))
