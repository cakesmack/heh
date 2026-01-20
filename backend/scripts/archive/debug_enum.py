
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.models.venue import VenueStatus

print(f"Enum members: {list(VenueStatus)}")
print(f"Enum values: {[v.value for v in VenueStatus]}")

try:
    print(f"Testing 'verified': {VenueStatus('verified')}")
except Exception as e:
    print(f"Error checking 'verified': {e}")

try:
    print(f"Testing 'invalid': {VenueStatus('invalid')}")
except Exception as e:
    print(f"Error checking 'invalid': {e}")
