"""
Geocoding API endpoints.
Provides address search and Highland region validation.
Also supports UK postcode lookup via OS Places API, Ideal Postcodes, and Google Geocode.
"""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.postcode_service import (
    lookup_postcode, 
    PostcodeLookupResult,
    search_os_places, OSPlacesSuggestion
)


router = APIRouter()





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
