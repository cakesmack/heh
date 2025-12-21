from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.collection import Collection
from app.schemas.collection import CollectionCreate, CollectionUpdate, Collection as CollectionSchema

router = APIRouter(tags=["Collections"])

@router.get("", response_model=List[CollectionSchema])
def list_collections(
    session: Session = Depends(get_session)
):
    """
    List active curated collections.
    """
    query = select(Collection).where(Collection.is_active == True).order_by(Collection.sort_order)
    collections = session.exec(query).all()
    return collections

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
