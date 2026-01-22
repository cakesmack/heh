import sys
import os
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import uuid4

# Mocking the Environment to run standalone
class MockEvent:
    def __init__(self, start, end, title, is_recurring=True):
        self.id = str(uuid4())
        self.title = title
        self.description = "Test"
        self.date_start = start
        self.date_end = end
        self.is_recurring = is_recurring
        self.venue_id = "v1"
        self.location_name = "Loc"
        self.latitude = 0.0
        self.longitude = 0.0
        self.geohash = "g1"
        self.category_id = "c1"
        self.price = 0
        self.price_display = "Free"
        self.min_price = 0
        self.image_url = None
        self.ticket_url = None
        self.website_url = None
        self.age_restriction = None
        self.min_age = 0
        self.organizer_id = "u1"
        self.organizer_profile_id = None
        self.status = "published"
        self.recurrence_group_id = self.id
        self.recurrence_rule = None

class MockSession:
    def __init__(self):
        self.added = []
    def add(self, obj):
        self.added.append(obj)
    def commit(self):
        pass
    def exec(self, stmt):
        return MockResult()

class MockResult:
    def all(self):
        return []

# Paste logic from recurrence.py directly to avoid import issues for this quick check
# (Or minimally modify to run)
def generate_recurring_instances(
    session,
    parent_event,
    weekdays=None,
    recurrence_end_date=None,
    window_days=90
):
    if not parent_event.is_recurring:
        return []

    new_instances = []
    
    # Logic from recurrence.py
    if recurrence_end_date:
        end_date = recurrence_end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    else:
        end_date = datetime.utcnow() + timedelta(days=window_days)
        
    duration = parent_event.date_end - parent_event.date_start
    current_date = parent_event.date_start
    
    effective_weekdays = weekdays
    if not effective_weekdays:
        effective_weekdays = [current_date.weekday()]
        
    # Start loop from next day
    current_date = current_date + timedelta(days=1)
    
    # Mock existing (empty)
    existing_dates = set()

    print(f"DEBUG: Start={parent_event.date_start}, EndLimit={end_date}")
    print(f"DEBUG: Weekdays={effective_weekdays}")

    while current_date <= end_date:
        if current_date.weekday() in effective_weekdays:
            if current_date.date() in existing_dates:
                current_date += timedelta(days=1)
                continue

            print(f"DEBUG: Generating event for {current_date}")
            child_event = MockEvent(current_date, current_date + duration, parent_event.title + " Child")
            session.add(child_event)
            new_instances.append(child_event)
        
        current_date += timedelta(days=1)
            
    return new_instances

# Test Case
if __name__ == "__main__":
    # Case: Jan 24 2026 (Saturday) to Jan 31 2026 (Saturday)
    # Start Date: Jan 24 2026, 19:00
    start_dt = datetime(2026, 1, 24, 19, 0, 0)
    end_dt = datetime(2026, 1, 24, 21, 0, 0)
    
    # Recurrence End: Jan 31 2026
    # Note: Frontend 'date' input usually sends YYYY-MM-DD which parses to midnight
    recur_end_input = datetime(2026, 1, 31, 0, 0, 0)
    
    parent = MockEvent(start_dt, end_dt, "Weekly Party")
    session = MockSession()
    
    print("\n--- Running Test 1: Weekly, explicit end date ---")
    generate_recurring_instances(
        session, 
        parent, 
        weekdays=[5], # Saturday
        recurrence_end_date=recur_end_input
    )
    
    print(f"\nResult: Generated {len(session.added)} instances.")
