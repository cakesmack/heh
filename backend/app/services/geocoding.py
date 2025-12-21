"""
Geocoding service using Mapbox API.
Provides address search and Highland region validation.
"""
from typing import Optional
import httpx
from pydantic import BaseModel

from app.core.config import settings


class GeocodeSuggestion(BaseModel):
    """A geocoding suggestion from Mapbox."""
    place_name: str
    latitude: float
    longitude: float
    relevance: float


async def search_address(query: str, limit: int = 5) -> list[GeocodeSuggestion]:
    """
    Search for addresses using Mapbox Geocoding API.

    Args:
        query: Search query string
        limit: Maximum number of results (default 5)

    Returns:
        List of geocoding suggestions

    Raises:
        httpx.HTTPError: If the API request fails
    """
    if not settings.MAPBOX_API_KEY:
        raise ValueError("MAPBOX_API_KEY not configured")

    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json"
    params = {
        "access_token": settings.MAPBOX_API_KEY,
        "limit": limit,
        "country": "GB",  # Limit to UK
        "bbox": f"{settings.HIGHLANDS_LON_MIN},{settings.HIGHLANDS_LAT_MIN},{settings.HIGHLANDS_LON_MAX},{settings.HIGHLANDS_LAT_MAX}"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    suggestions = []
    for feature in data.get("features", []):
        # Extract coordinates [longitude, latitude]
        coords = feature.get("geometry", {}).get("coordinates", [])
        if len(coords) >= 2:
            suggestions.append(GeocodeSuggestion(
                place_name=feature.get("place_name", ""),
                latitude=coords[1],  # Mapbox returns [lng, lat]
                longitude=coords[0],
                relevance=feature.get("relevance", 0.0)
            ))

    return suggestions


def validate_highland_region(latitude: float, longitude: float) -> bool:
    """
    Check if coordinates are within the Highland region bounds.

    Args:
        latitude: Latitude coordinate
        longitude: Longitude coordinate

    Returns:
        True if coordinates are within Highland bounds, False otherwise
    """
    return (
        settings.HIGHLANDS_LAT_MIN <= latitude <= settings.HIGHLANDS_LAT_MAX and
        settings.HIGHLANDS_LON_MIN <= longitude <= settings.HIGHLANDS_LON_MAX
    )
