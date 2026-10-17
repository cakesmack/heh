"""Canonical text-location matching for public Events search and admin roundups.

Venue.city is optional legacy data, not a required location relationship. Keep
the public search's address/name/postcode and event-level fallbacks alongside it.
Callers retain their primary Venue outer join; participating venues use EXISTS.
"""
from sqlalchemy import or_
from sqlalchemy.orm import aliased

from app.models.event import Event
from app.models.venue import Venue


def venue_location_filter(location, venue=Venue):
    term = f'%{location.strip()}%'
    return or_(venue.city.ilike(term), venue.name.ilike(term), venue.address.ilike(term),
               venue.postcode.ilike(term), venue.formatted_address.ilike(term))


def event_location_parts(location):
    term = f'%{location.strip()}%'
    participating = aliased(Venue)
    return (
        venue_location_filter(location),
        Event.participating_venues.of_type(participating).any(venue_location_filter(location, participating)),
        or_(Event.location_name.ilike(term), Event.postcode.ilike(term), Event.address_full.ilike(term)),
    )


def event_location_filter(location):
    return or_(*event_location_parts(location))
