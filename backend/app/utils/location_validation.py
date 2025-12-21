"""
Location validation utilities for check-in verification.
Validates proximity and time windows for event check-ins.
"""
from datetime import datetime, timedelta
from typing import Tuple

from app.core.config import settings
from app.services.geolocation import calculate_distance_meters


def validate_checkin_location(
    event_lat: float,
    event_lon: float,
    user_lat: float,
    user_lon: float,
    max_distance_meters: int = None
) -> Tuple[bool, float]:
    """
    Validate that user is within acceptable distance of event location.

    Args:
        event_lat: Event latitude
        event_lon: Event longitude
        user_lat: User's current latitude
        user_lon: User's current longitude
        max_distance_meters: Max allowed distance (uses config default if None)

    Returns:
        Tuple of (is_valid, distance_meters)
    """
    if max_distance_meters is None:
        max_distance_meters = settings.CHECKIN_MAX_DISTANCE_METERS

    distance = calculate_distance_meters(event_lat, event_lon, user_lat, user_lon)

    is_valid = distance <= max_distance_meters

    return (is_valid, distance)


def is_within_time_window(
    event_start: datetime,
    event_end: datetime,
    checkin_time: datetime = None,
    buffer_minutes: int = None
) -> Tuple[bool, str]:
    """
    Validate that check-in time is within acceptable window.

    Args:
        event_start: Event start datetime
        event_end: Event end datetime
        checkin_time: Check-in time (uses current time if None)
        buffer_minutes: Minutes before/after event (uses config default if None)

    Returns:
        Tuple of (is_valid, reason)
    """
    if checkin_time is None:
        checkin_time = datetime.utcnow()

    if buffer_minutes is None:
        buffer_minutes = settings.CHECKIN_TIME_BUFFER_MINUTES

    buffer = timedelta(minutes=buffer_minutes)

    # Calculate valid window
    window_start = event_start - buffer
    window_end = event_end + buffer

    # Check if within window
    if checkin_time < window_start:
        return (False, f"Too early. Check-in opens {buffer_minutes} minutes before event.")
    elif checkin_time > window_end:
        return (False, f"Too late. Check-in closes {buffer_minutes} minutes after event ends.")
    else:
        return (True, "Within valid time window")


def is_night_checkin(checkin_time: datetime = None) -> bool:
    """
    Check if check-in occurred during evening hours (after 6pm).

    Args:
        checkin_time: Check-in time (uses current time if None)

    Returns:
        True if check-in is after 18:00 local time
    """
    if checkin_time is None:
        checkin_time = datetime.utcnow()

    # Note: This uses UTC time. In production, convert to local timezone
    return checkin_time.hour >= 18


def validate_coordinates(latitude: float, longitude: float) -> Tuple[bool, str]:
    """
    Validate that coordinates are within valid ranges.

    Args:
        latitude: Latitude coordinate
        longitude: Longitude coordinate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not (-90.0 <= latitude <= 90.0):
        return (False, "Latitude must be between -90 and 90")

    if not (-180.0 <= longitude <= 180.0):
        return (False, "Longitude must be between -180 and 180")

    return (True, "")
