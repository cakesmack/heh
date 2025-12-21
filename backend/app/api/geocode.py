"""
Geocoding API endpoints.
Provides address search and Highland region validation.
Also supports UK postcode lookup via OS Places API, Ideal Postcodes, and Google Geocode.
"""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.geocoding import search_address, validate_highland_region, GeocodeSuggestion
from app.services.postcode_service import (
    lookup_postcode, autocomplete_address, lookup_address_by_id, 
    PostcodeLookupResult, AddressSuggestion,
    search_os_places, OSPlacesSuggestion
)


router = APIRouter()


class GeocodeSearchResponse(BaseModel):
    """Response for geocode search."""
    suggestions: list[GeocodeSuggestion]


class ValidateResponse(BaseModel):
    """Response for coordinate validation."""
    valid: bool
    message: str


@router.get("/search", response_model=GeocodeSearchResponse)
async def geocode_search(
    query: str = Query(..., min_length=1, description="Address search query"),
    limit: int = Query(5, ge=1, le=10, description="Maximum number of results")
):
    """
    Search for addresses using Mapbox Geocoding API.
    Returns suggestions within the Highland region.
    """
    try:
        suggestions = await search_address(query, limit)
        return GeocodeSearchResponse(suggestions=suggestions)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Geocoding service error: {str(e)}")


@router.get("/validate", response_model=ValidateResponse)
async def validate_coordinates(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude coordinate"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude coordinate")
):
    """
    Validate if coordinates are within the Highland region bounds.
    """
    is_valid = validate_highland_region(latitude, longitude)

    if is_valid:
        return ValidateResponse(
            valid=True,
            message="Coordinates are within the Highland region"
        )
    else:
        return ValidateResponse(
            valid=False,
            message="Coordinates are outside the Highland region"
        )


@router.get("/postcode/{postcode}", response_model=PostcodeLookupResult)
async def geocode_postcode(postcode: str):
    """
    Look up a UK postcode and return address + coordinates.

    Uses Ideal Postcodes API as primary, Google Geocode as fallback.
    """
    result = await lookup_postcode(postcode)

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Postcode not found or geocoding service unavailable"
        )

    return result


@router.get("/autocomplete", response_model=list[AddressSuggestion])
async def address_autocomplete(
    q: str = Query(..., min_length=2, description="Address search query")
):
    """
    Autocomplete address search using Ideal Postcodes.
    """
    suggestions = await autocomplete_address(q)
    return suggestions


@router.get("/address/{address_id}", response_model=PostcodeLookupResult)
async def get_address_details(address_id: str):
    """
    Get full address details by ID (UDPRN).
    """
    result = await lookup_address_by_id(address_id)
    
    if not result:
        raise HTTPException(
            status_code=404,
            detail="Address not found"
        )
    
    return result


@router.get("/os-places", response_model=List[OSPlacesSuggestion])
async def os_places_search(
    q: str = Query(..., min_length=3, description="Address or postcode search query"),
    limit: int = Query(10, ge=1, le=20, description="Maximum number of results")
):
    """
    Search for addresses using OS Places API.
    Returns results filtered to Scottish Highlands region only.
    Provides full street-level address data.
    """
    suggestions = await search_os_places(q, limit)
    return suggestions
