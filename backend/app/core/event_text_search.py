"""The existing public event text-search predicate, reusable by collections."""
from sqlalchemy import or_
from app.models.event import Event
from app.models.category import Category
from app.models.venue import Venue
from app.models.tag import Tag, normalize_tag_name


def event_text_search_condition(query: str, *, joined: bool = False):
    # Preserve public search: substring of the full phrase, with slug-normalized
    # tags (not word tokenisation). Public's existing joins remain unchanged.
    term = f"%{query}%"
    tag_term = normalize_tag_name(query)
    venue = or_(Venue.name.ilike(term), Venue.address.ilike(term),
                Venue.formatted_address.ilike(term), Venue.postcode.ilike(term))
    tags = or_(Tag.name == tag_term, Tag.name.ilike(f"%{tag_term}%"))
    category = or_(Category.name.ilike(term), Category.slug.ilike(term))
    return or_(
        Event.title.ilike(term), Event.description.ilike(term),
        Event.location_name.ilike(term), Event.address_full.ilike(term), Event.postcode.ilike(term),
        venue if joined else Event.venue.has(venue),
        tags if joined else Event.tags.any(tags),
        category if joined else Event.category_rel.has(category),
    )


def collection_keywords(params: dict) -> list[str]:
    """An explicit array supersedes legacy q; a legacy phrase stays one term."""
    raw = params.get('keywords') if 'keywords' in params else params.get('q')
    values = [raw] if isinstance(raw, str) else raw if isinstance(raw, list) else []
    result, seen = [], set()
    for value in values:
        if not isinstance(value, str):
            continue
        term = value.strip()
        if term and term.casefold() not in seen:
            result.append(term)
            seen.add(term.casefold())
    return result
