"""
UK Postcode geocoding service.
Primary: OS Places API (Ordnance Survey)
Secondary: Ideal Postcodes API
Fallback: Google Geocode API
"""
import httpx
from typing import Optional, List
from pydantic import BaseModel

from app.core.config import settings


# Scottish Highlands bounding box
HIGHLANDS_BOUNDS = {
    "min_lat": 56.4,
    "max_lat": 58.8,
    "min_lng": -7.5,
    "max_lng": -3.0,
}


class PostcodeLookupResult(BaseModel):
    """Result of a postcode lookup."""
    postcode: str
    address_full: str
    latitude: float
    longitude: float
    town: Optional[str] = None
    county: Optional[str] = None
    country: str = "United Kingdom"



class OSPlacesSuggestion(BaseModel):
    """Address/postcode suggestion."""
    id: str
    address: str
    latitude: float
    longitude: float


async def search_os_places(query: str, limit: int = 10) -> List[OSPlacesSuggestion]:
    """
    Search for postcodes using Postcodes.io API (free, no key required).
    Filters results to Scottish Highlands region.
    """
    suggestions = []
    
    async with httpx.AsyncClient() as client:
        try:
            # Check if query looks like a postcode
            clean_query = query.upper().replace(" ", "")
            
            # Try postcode autocomplete first
            response = await client.get(
                f"https://api.postcodes.io/postcodes/{clean_query}/autocomplete",
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                postcodes = data.get("result") or []
                
                # Look up each postcode to get coordinates
                for postcode in postcodes[:limit * 2]:  # Get extra to account for filtering
                    lookup_resp = await client.get(
                        f"https://api.postcodes.io/postcodes/{postcode}",
                        timeout=5.0
                    )
                    
                    if lookup_resp.status_code == 200:
                        lookup_data = lookup_resp.json()
                        result = lookup_data.get("result")
                        
                        if result:
                            lat = result.get("latitude")
                            lng = result.get("longitude")
                            
                            # Filter to Scottish Highlands only
                            if lat and lng:
                                if (
                                    HIGHLANDS_BOUNDS["min_lat"] <= lat <= HIGHLANDS_BOUNDS["max_lat"] and
                                    HIGHLANDS_BOUNDS["min_lng"] <= lng <= HIGHLANDS_BOUNDS["max_lng"]
                                ):
                                    # Format postcode with space
                                    formatted = postcode
                                    if len(postcode) > 3 and " " not in postcode:
                                        formatted = f"{postcode[:-3]} {postcode[-3:]}"
                                    
                                    area = result.get("admin_ward") or result.get("parliamentary_constituency") or ""
                                    town = result.get("admin_district") or ""
                                    
                                    address = f"{formatted}, {area}, {town}".strip(", ")
                                    
                                    suggestions.append(OSPlacesSuggestion(
                                        id=postcode,
                                        address=address,
                                        latitude=lat,
                                        longitude=lng,
                                    ))
                                    
                                    if len(suggestions) >= limit:
                                        break
            
            # If no postcode results, try place search
            if not suggestions and len(query) >= 3:
                response = await client.get(
                    f"https://api.postcodes.io/places?q={query}&limit=10",
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    places = data.get("result") or []
                    
                    for place in places:
                        lat = place.get("latitude")
                        lng = place.get("longitude")
                        
                        if lat and lng:
                            if (
                                HIGHLANDS_BOUNDS["min_lat"] <= lat <= HIGHLANDS_BOUNDS["max_lat"] and
                                HIGHLANDS_BOUNDS["min_lng"] <= lng <= HIGHLANDS_BOUNDS["max_lng"]
                            ):
                                name = place.get("name_1") or place.get("name_2") or ""
                                county = place.get("county_unitary") or ""
                                
                                suggestions.append(OSPlacesSuggestion(
                                    id=place.get("code") or f"{lat}-{lng}",
                                    address=f"{name}, {county}".strip(", "),
                                    latitude=lat,
                                    longitude=lng,
                                ))
                                
                                if len(suggestions) >= limit:
                                    break
            
            return suggestions
            
        except Exception as e:
            print(f"Postcodes.io API error: {e}")
            return []



async def lookup_postcode(postcode: str) -> Optional[PostcodeLookupResult]:
    """
    Look up a UK postcode and return address + coordinates.

    Uses Google Geocode API as fallback.
    """
    # Clean postcode
    postcode = postcode.upper().replace(" ", "")

    # Fallback to Google
    if settings.GOOGLE_GEOCODE_API_KEY:
        result = await _google_geocode_lookup(postcode)
        if result:
            return result

    return None





async def _google_geocode_lookup(postcode: str) -> Optional[PostcodeLookupResult]:
    """Look up postcode using Google Geocode API."""
    url = "https://maps.googleapis.com/maps/api/geocode/json"

    # Format postcode with space for better results
    if len(postcode) > 3 and " " not in postcode:
        search_postcode = f"{postcode[:-3]} {postcode[-3:]}"
    else:
        search_postcode = postcode

    params = {
        "address": f"{search_postcode}, UK",
        "key": settings.GOOGLE_GEOCODE_API_KEY,
        "components": "country:GB"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)

            if response.status_code != 200:
                return None

            data = response.json()

            if data.get("status") != "OK" or not data.get("results"):
                return None

            result = data["results"][0]
            location = result["geometry"]["location"]

            # Extract address components
            town = None
            county = None
            for component in result.get("address_components", []):
                types = component.get("types", [])
                if "postal_town" in types:
                    town = component.get("long_name")
                elif "administrative_area_level_2" in types:
                    county = component.get("long_name")

            return PostcodeLookupResult(
                postcode=search_postcode,
                address_full=result.get("formatted_address", postcode),
                latitude=location["lat"],
                longitude=location["lng"],
                town=town,
                county=county,
                country="United Kingdom"
            )

        except Exception as e:
            print(f"Google Geocode error: {e}")
            return None
