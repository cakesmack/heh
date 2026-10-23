"""Event category matching and write validation, retaining the primary identity."""
from fastapi import HTTPException
from sqlalchemy import or_

from app.core.utils import normalize_uuid
from app.models.category import Category
from app.models.event import Event


def event_category_filter(category_ids):
    return or_(Event.category_id.in_(category_ids), Event.secondary_category_id.in_(category_ids))


def validate_event_categories(session, primary, secondary):
    primary = normalize_uuid(primary) if primary else None
    secondary = normalize_uuid(secondary) if secondary else None
    if not primary:
        raise HTTPException(422, "Primary category is required")
    if primary == secondary:
        raise HTTPException(422, "Primary and secondary categories must be different")
    for category_id in (primary, secondary):
        if category_id and not session.get(Category, category_id):
            raise HTTPException(404, "Category not found")
    return primary, secondary
