"""
Geolocation services for geocoding, distance calculations, and geohashing.
Handles location validation and spatial operations.
"""
import math
import pygeohash as pgh
from typing import Optional, Tuple
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

from app.core.config import settings


# Initialize geocoder
geolocator = Nominatim(user_agent="highland_events_app")


def geocode_address(address: str) -> Optional[Tuple[float, float]]:
    """
    Convert an address to latitude/longitude coordinates.

    Args:
        address: Full address string

    Returns:
        Tuple of (latitude, longitude) or None if geocoding fails
    """
    try:
        location = geolocator.geocode(address, timeout=10)
        if location:
            return (location.latitude, location.longitude)
        return None
    except (GeocoderTimedOut, GeocoderServiceError):
        return None


def reverse_geocode(latitude: float, longitude: float) -> Optional[str]:
    """
    Convert coordinates to an address.

    Args:
        latitude: Latitude coordinate
        longitude: Longitude coordinate

    Returns:
        Address string or None if reverse geocoding fails
    """
    try:
        location = geolocator.reverse(f"{latitude}, {longitude}", timeout=10)
        if location:
            return location.address
        return None
    except (GeocoderTimedOut, GeocoderServiceError):
        return None


def calculate_geohash(latitude: float, longitude: float, precision: int = 9) -> str:
    """
    Calculate geohash for coordinates.
    Used for efficient spatial indexing and proximity queries.

    Args:
        latitude: Latitude coordinate
        longitude: Longitude coordinate
        precision: Geohash precision (default 9 = ~5m accuracy)

    Returns:
        Geohash string
    """
    return pgh.encode(latitude, longitude, precision=precision)


def haversine_distance(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:
    """
    Calculate distance between two coordinate points using Haversine formula.

    Args:
        lat1: Latitude of point 1
        lon1: Longitude of point 1
        lat2: Latitude of point 2
        lon2: Longitude of point 2

    Returns:
        Distance in kilometers
    """
    # Radius of Earth in kilometers
    R = 6371.0

    # Convert degrees to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    # Differences
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    # Haversine formula
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distance = R * c
    return distance


def is_within_highlands(latitude: float, longitude: float) -> bool:
    """
    Check if coordinates are within the Scottish Highlands region.

    Args:
        latitude: Latitude coordinate
        longitude: Longitude coordinate

    Returns:
        True if within Highlands boundaries, False otherwise
    """
    return (
        settings.HIGHLANDS_LAT_MIN <= latitude <= settings.HIGHLANDS_LAT_MAX and
        settings.HIGHLANDS_LON_MIN <= longitude <= settings.HIGHLANDS_LON_MAX
    )


def calculate_distance_meters(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:
    """
    Calculate distance between two points in meters.

    Args:
        lat1: Latitude of point 1
        lon1: Longitude of point 1
        lat2: Latitude of point 2
        lon2: Longitude of point 2

    Returns:
        Distance in meters
    """
    return haversine_distance(lat1, lon1, lat2, lon2) * 1000


def get_bounding_box(
    latitude: float,
    longitude: float,
    radius_km: float
) -> Tuple[float, float, float, float]:
    """
    Calculate bounding box coordinates for a given center point and radius.
    Useful for efficient database queries.

    Args:
        latitude: Center latitude
        longitude: Center longitude
        radius_km: Radius in kilometers

    Returns:
        Tuple of (min_lat, max_lat, min_lon, max_lon)
    """
    # Approximate degrees per kilometer (varies by latitude)
    lat_degree_km = 111.0
    lon_degree_km = 111.0 * math.cos(math.radians(latitude))

    lat_offset = radius_km / lat_degree_km
    lon_offset = radius_km / lon_degree_km

    min_lat = latitude - lat_offset
    max_lat = latitude + lat_offset
    min_lon = longitude - lon_offset
    max_lon = longitude + lon_offset

    return (min_lat, max_lat, min_lon, max_lon)
