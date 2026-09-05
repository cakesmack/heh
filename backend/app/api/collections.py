from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, or_, and_
from sqlalchemy import func, update
from sqlalchemy.exc import IntegrityError

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.utils import normalize_uuid, generate_seo_slug
from app.models.user import User
from app.models.collection import Collection
from app.models.event import Event
from app.models.category import Category
from app.models.venue import Venue
from app.models.event_participating_venue import EventParticipatingVenue
from app.schemas.collection import CollectionCreate, CollectionUpdate, Collection as CollectionSchema, VenueSummary

router = APIRouter(tags=["Collections"])

@router.get("", response_model=List[CollectionSchema])
def list_collections(
    show_on_map: Optional[bool] = None,
    include_inactive: bool = False,
    session: Session = Depends(get_session)
):
    """
    List curated collections.
    By default, lists only active collections (for public display).
    Set include_inactive=True to return all collections (for admin management).
    """
    query = select(Collection)
    if not include_inactive:
        query = query.where(Collection.is_active == True)
    
    if show_on_map is not None:
        query = query.where(Collection.show_on_map == show_on_map)
        
    query = query.order_by(Collection.sort_order)
    collections = session.exec(query).all()
    return collections

def build_collection_events_query(collection: Collection, session: Session):
    """
    Build the base SQLAlchemy query for published events matching a collection.
    Enforces organizer_profile_ids as an absolute root boundary (AND condition),
    preventing flexible OR conditions (categories/keywords) from leaking events.
    """
    query = select(Event).where(Event.status == "published")

    # 1. Apply absolute boundaries FIRST (Strict root-level AND boundary)
    if collection.organizer_profile_ids:
        raw_org_ids = [str(oid).strip() for oid in collection.organizer_profile_ids if oid]
        ids_to_match = list(set(raw_org_ids + [normalize_uuid(oid) for oid in raw_org_ids]))
        if ids_to_match:
            query = query.where(Event.organizer_profile_id.in_(ids_to_match))

    if collection.specific_venue_ids:
        venue_ids = [normalize_uuid(vid) for vid in collection.specific_venue_ids if vid]
        if venue_ids:
            query = query.where(Event.venue_id.in_(venue_ids))

    # Geographic bounding box filter
    if (
        collection.min_lat is not None and collection.max_lat is not None and
        collection.min_lng is not None and collection.max_lng is not None
    ):
        query = query.join(Venue, Event.venue_id == Venue.id).where(
            Venue.latitude.between(collection.min_lat, collection.max_lat),
            Venue.longitude.between(collection.min_lng, collection.max_lng),
        )

    # 2. Extract flexible Keyword/Category conditions inside isolated blocks
    filter_params = collection.filter_params or {}
    category_conditions = []
    keyword_conditions = []

    # Category conditions
    raw_cats = filter_params.get("category_ids") or filter_params.get("category") or []
    if isinstance(raw_cats, str):
        raw_cats = [c.strip() for c in raw_cats.split(",") if c.strip()]
    if raw_cats:
        cat_ids = []
        for item in raw_cats:
            item_str = str(item).strip()
            norm = normalize_uuid(item_str)
            if len(norm) == 32 and all(c in "0123456789abcdefABCDEF" for c in norm):
                cat_ids.append(norm)
            else:
                cat = session.exec(
                    select(Category).where(
                        (Category.slug == item_str.lower()) |
                        (func.lower(Category.name) == item_str.lower())
                    )
                ).first()
                if cat:
                    cat_ids.append(cat.id)
        if cat_ids:
            category_conditions.append(Event.category_id.in_(cat_ids))

    # Keyword conditions (search keywords in title, description, location_name)
    q = filter_params.get("q")
    if q and str(q).strip():
        search_term = f"%{str(q).strip()}%"
        keyword_conditions.append(
            or_(
                Event.title.ilike(search_term),
                Event.description.ilike(search_term),
                Event.location_name.ilike(search_term),
            )
        )

    # 3. Apply the flexible Keyword/Category logic inside their own isolated blocks
    match_mode = getattr(collection, "match_mode", None)
    if not match_mode:
        match_mode = (filter_params.get("combine_operator") or filter_params.get("match_mode") or "and").upper()

    keyword_block = or_(*keyword_conditions) if len(keyword_conditions) > 1 else (keyword_conditions[0] if keyword_conditions else None)
    category_block = or_(*category_conditions) if len(category_conditions) > 1 else (category_conditions[0] if category_conditions else None)

    if keyword_block is not None and category_block is not None:
        if match_mode == "OR":
            query = query.where(or_(keyword_block, category_block))
        else:
            query = query.where(and_(keyword_block, category_block))
    elif keyword_block is not None:
        query = query.where(keyword_block)
    elif category_block is not None:
        query = query.where(category_block)

    # 4. Root-level exclusions, pricing, recurrence, and dates
    exclude_events = filter_params.get("exclude_event_ids")
    if exclude_events:
        if isinstance(exclude_events, str):
            exclude_events = [e.strip() for e in exclude_events.split(",") if e.strip()]
        exclude_uuids = [normalize_uuid(e) for e in exclude_events if e]
        if exclude_uuids:
            query = query.where(Event.id.notin_(exclude_uuids))

    exclude_age = filter_params.get("exclude_age_restrictions")
    if exclude_age:
        if isinstance(exclude_age, str):
            exclude_age = [a.strip() for a in exclude_age.split(",") if a.strip()]
        if exclude_age:
            query = query.where(
                or_(Event.age_restriction.notin_(exclude_age), Event.age_restriction == None)
            )

    age_restriction = filter_params.get("age_restriction")
    if age_restriction:
        query = query.where(Event.age_restriction == age_restriction)

    price = filter_params.get("price")
    if price == "free":
        query = query.where(Event.price == 0)
    elif price == "paid":
        query = query.where(Event.price > 0)

    is_recurring = filter_params.get("is_recurring")
    if is_recurring is not None:
        query = query.where(Event.is_recurring == is_recurring)

    now_utc = datetime.now(timezone.utc)
    if collection.fixed_start_date:
        query = query.where(func.coalesce(Event.date_end, Event.date_start) >= collection.fixed_start_date)
    elif filter_params.get("date_from"):
        query = query.where(func.coalesce(Event.date_end, Event.date_start) >= filter_params["date_from"])
    else:
        query = query.where(func.coalesce(Event.date_end, Event.date_start) >= now_utc)

    if collection.fixed_end_date:
        query = query.where(Event.date_start <= collection.fixed_end_date)
    elif filter_params.get("date_to"):
        query = query.where(Event.date_start <= filter_params["date_to"])

    return query


def get_collection_venues(collection: Collection, session: Session) -> tuple[List[VenueSummary], int]:
    """
    Compute all distinct venues associated with all published events in a collection.
    Aggregates primary event venues, participating venues, and custom unlinked location names.
    Returns an alphabetized list of VenueSummary and total distinct count.
    """
    events_subquery = build_collection_events_query(collection, session).subquery()
    venue_map: dict[str, VenueSummary] = {}

    # 1. Primary venues linked via Event.venue_id
    primary_query = (
        select(Venue)
        .join(events_subquery, events_subquery.c.venue_id == Venue.id)
        .distinct()
    )
    for v in session.exec(primary_query).all():
        if v.name and v.name.strip():
            key = v.name.strip().lower()
            venue_map[key] = VenueSummary(
                id=str(v.id) if v.id else None,
                name=v.name.strip(),
                slug=v.slug,
                city=v.city,
            )

    # 2. Participating venues via event_participating_venues
    part_query = (
        select(Venue)
        .join(EventParticipatingVenue, EventParticipatingVenue.venue_id == Venue.id)
        .join(events_subquery, events_subquery.c.id == EventParticipatingVenue.event_id)
        .distinct()
    )
    for v in session.exec(part_query).all():
        if v.name and v.name.strip():
            key = v.name.strip().lower()
            if key not in venue_map:
                venue_map[key] = VenueSummary(
                    id=str(v.id) if v.id else None,
                    name=v.name.strip(),
                    slug=v.slug,
                    city=v.city,
                )

    # 3. Custom location names for events without a linked venue_id
    unlinked_query = (
        select(events_subquery.c.location_name)
        .where(
            events_subquery.c.venue_id == None,
            events_subquery.c.location_name != None
        )
        .distinct()
    )
    for loc in session.exec(unlinked_query).all():
        if loc and str(loc).strip():
            cleaned = str(loc).strip()
            key = cleaned.lower()
            if key not in venue_map:
                venue_map[key] = VenueSummary(id=None, name=cleaned, slug=None, city=None)

    sorted_venues = sorted(venue_map.values(), key=lambda v: v.name.lower())
    return sorted_venues, len(sorted_venues)


@router.get("/slug/{slug}", response_model=CollectionSchema)
def get_collection_by_slug(
    slug: str,
    session: Session = Depends(get_session)
):
    """
    Get a single active collection by its URL slug (public).
    Includes pre-aggregated venues and total_venue_count.
    """
    collection = session.exec(
        select(Collection).where(Collection.slug == slug, Collection.is_active == True)
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    venues, total_venue_count = get_collection_venues(collection, session)

    data = collection.model_dump()
    data["venues"] = venues
    data["total_venue_count"] = total_venue_count
    return CollectionSchema(**data)


@router.get("/slug/{slug}/events")
def get_collection_events(
    slug: str,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=1000),
    session: Session = Depends(get_session)
):
    """
    Get populated events for a specific collection by URL slug.
    Enforces organizer_profile_ids as an absolute root boundary (AND condition),
    preventing flexible OR conditions (categories/keywords) from leaking events.
    """
    collection = session.exec(
        select(Collection).where(Collection.slug == slug, Collection.is_active == True)
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    query = build_collection_events_query(collection, session)

    count_query = select(func.count()).select_from(query.subquery())
    total = session.exec(count_query).one()

    events_query = query.order_by(Event.date_start).offset(skip).limit(limit)
    events = session.exec(events_query).all()

    return {"events": events, "total": total, "skip": skip, "limit": limit}

@router.post("", response_model=CollectionSchema, status_code=status.HTTP_201_CREATED)
def create_collection(
    collection_data: CollectionCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Create a new collection (Admin only).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    raw_slug = (collection_data.slug or "").strip().lower()
    if not raw_slug and collection_data.title:
        raw_slug = generate_seo_slug(collection_data.title)

    if raw_slug:
        existing = session.exec(select(Collection).where(Collection.slug == raw_slug)).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A collection with the slug '{raw_slug}' already exists ('{existing.title}'). Please edit the existing collection or choose a different slug."
            )

    collection = Collection.model_validate(collection_data)
    if raw_slug:
        collection.slug = raw_slug

    session.add(collection)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A collection with the slug '{raw_slug or collection.title}' already exists."
        )

    session.refresh(collection)
    return collection

@router.put("/{collection_id}", response_model=CollectionSchema)
def update_collection(
    collection_id: int,
    collection_data: CollectionUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Update a collection (Admin only).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    collection = session.get(Collection, collection_id)
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    update_data = collection_data.model_dump(exclude_unset=True)

    if "slug" in update_data and update_data["slug"]:
        new_slug = update_data["slug"].strip().lower()
        existing = session.exec(
            select(Collection).where(Collection.slug == new_slug, Collection.id != collection_id)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A collection with the slug '{new_slug}' already exists ('{existing.title}'). Please choose a different slug."
            )
        update_data["slug"] = new_slug

    for key, value in update_data.items():
        setattr(collection, key, value)

    session.add(collection)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A database constraint error occurred while saving the collection."
        )

    session.refresh(collection)
    return collection

@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Delete a collection (Admin only).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    collection = session.get(Collection, collection_id)
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    session.delete(collection)
    session.commit()
    return None

@router.post("/seed", response_model=List[CollectionSchema])
def seed_collections(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Seed default collections (Admin only).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Check if collections exist
    existing = session.exec(select(Collection)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Collections already seeded")

    seeds = [
        Collection(
            title="Family Friendly",
            subtitle="Fun for all ages",
            target_link="/events?q=family",
            image_url="/images/collections/family.jpg",
            sort_order=1
        ),
        Collection(
            title="Free This Weekend",
            subtitle="Budget-friendly fun",
            target_link="/events?price_max=0&date=weekend",
            image_url="/images/collections/free.jpg",
            sort_order=2
        ),
        Collection(
            title="Live Music",
            subtitle="Gigs & Festivals",
            target_link="/events?category=music",
            image_url="/images/collections/music.jpg",
            sort_order=3
        )
    ]

    for seed in seeds:
        session.add(seed)
    
    session.commit()
    
    # Return all created
    return session.exec(select(Collection).order_by(Collection.sort_order)).all()


@router.post("/{collection_id}/track-view", status_code=status.HTTP_200_OK, include_in_schema=False)
@router.post("/{collection_id}/track-view/", status_code=status.HTTP_200_OK)
def track_collection_view(
    collection_id: str,
    session: Session = Depends(get_session)
):
    """
    Atomically increment view_count for a collection by ID or slug.
    Public endpoint.
    """
    if collection_id.isdigit():
        col_id = int(collection_id)
        condition = or_(Collection.id == col_id, Collection.slug == collection_id)
    else:
        condition = Collection.slug == collection_id

    collection = session.exec(select(Collection).where(condition)).first()
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    session.exec(
        update(Collection)
        .where(Collection.id == collection.id)
        .values(view_count=Collection.view_count + 1)
    )
    session.commit()
    session.refresh(collection)
    return {"status": "ok", "view_count": collection.view_count}


@router.post("/{collection_id}/track-click", status_code=status.HTTP_200_OK, include_in_schema=False)
@router.post("/{collection_id}/track-click/", status_code=status.HTTP_200_OK)
def track_collection_click(
    collection_id: str,
    session: Session = Depends(get_session)
):
    """
    Atomically increment link_click_count for a collection by ID or slug.
    Public endpoint.
    """
    if collection_id.isdigit():
        col_id = int(collection_id)
        condition = or_(Collection.id == col_id, Collection.slug == collection_id)
    else:
        condition = Collection.slug == collection_id

    collection = session.exec(select(Collection).where(condition)).first()
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    session.exec(
        update(Collection)
        .where(Collection.id == collection.id)
        .values(link_click_count=Collection.link_click_count + 1)
    )
    session.commit()
    session.refresh(collection)
    return {"status": "ok", "link_click_count": collection.link_click_count}
