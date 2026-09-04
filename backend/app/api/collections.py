from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from sqlalchemy import func

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.utils import normalize_uuid
from app.models.user import User
from app.models.collection import Collection
from app.models.event import Event
from app.schemas.collection import CollectionCreate, CollectionUpdate, Collection as CollectionSchema

router = APIRouter(tags=["Collections"])

@router.get("", response_model=List[CollectionSchema])
def list_collections(
    show_on_map: Optional[bool] = None,
    session: Session = Depends(get_session)
):
    """
    List active curated collections.
    """
    query = select(Collection).where(Collection.is_active == True)
    
    if show_on_map is not None:
        query = query.where(Collection.show_on_map == show_on_map)
        
    query = query.order_by(Collection.sort_order)
    collections = session.exec(query).all()
    return collections

@router.get("/slug/{slug}", response_model=CollectionSchema)
def get_collection_by_slug(
    slug: str,
    session: Session = Depends(get_session)
):
    """
    Get a single active collection by its URL slug (public).
    """
    collection = session.exec(
        select(Collection).where(Collection.slug == slug, Collection.is_active == True)
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection

@router.get("/slug/{slug}/events")
def get_collection_events(
    slug: str,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=1000),
    session: Session = Depends(get_session)
):
    """
    Get populated events for a specific collection by URL slug.
    If organizer_profile_ids is configured, strictly filters to those organizers.
    """
    collection = session.exec(
        select(Collection).where(Collection.slug == slug, Collection.is_active == True)
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    query = select(Event).where(Event.status == "published")
    if collection.organizer_profile_ids:
        normalized_org_ids = [normalize_uuid(oid) for oid in collection.organizer_profile_ids if oid]
        if normalized_org_ids:
            query = query.where(Event.organizer_profile_id.in_(normalized_org_ids))

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

    collection = Collection.model_validate(collection_data)
    session.add(collection)
    session.commit()
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
    for key, value in update_data.items():
        setattr(collection, key, value)

    session.add(collection)
    session.commit()
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
