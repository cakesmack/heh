"""
Categories API routes.
Handles category CRUD operations (admin-only for mutations).
"""
from datetime import datetime
from typing import Optional
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.utils import normalize_uuid
from app.models.user import User
from app.models.category import Category
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    CategoryListResponse,
    generate_slug
)

router = APIRouter(tags=["Categories"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that requires admin privileges."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@router.get("", response_model=CategoryListResponse)
def list_categories(
    active_only: bool = Query(default=True),
    session: Session = Depends(get_session)
):
    """
    List all categories.

    By default, returns only active categories sorted by display_order.
    """
    query = select(Category)

    if active_only:
        query = query.where(Category.is_active == True)

    query = query.order_by(Category.display_order, Category.name)
    categories = session.exec(query).all()

    # Build response with event counts
    category_responses = []
    for cat in categories:
        response = CategoryResponse.model_validate(cat)
        response.event_count = len(cat.events) if cat.events else 0
        category_responses.append(response)

    return CategoryListResponse(
        categories=category_responses,
        total=len(category_responses)
    )


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Create a new category (admin only).
    """
    # Generate slug if not provided
    slug = category_data.slug or generate_slug(category_data.name)

    # Check for duplicate name or slug
    existing = session.exec(
        select(Category).where(
            (Category.name == category_data.name) | (Category.slug == slug)
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this name or slug already exists"
        )

    new_category = Category(
        id=normalize_uuid(uuid4()),
        name=category_data.name,
        slug=slug,
        description=category_data.description,
        image_url=category_data.image_url,
        gradient_color=category_data.gradient_color,
        display_order=category_data.display_order,
        is_active=category_data.is_active
    )

    session.add(new_category)
    session.commit()
    session.refresh(new_category)

    response = CategoryResponse.model_validate(new_category)
    response.event_count = 0
    return response


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: str,
    session: Session = Depends(get_session)
):
    """
    Get a category by ID or slug.
    """
    # Try by ID first, then by slug
    category = session.get(Category, normalize_uuid(category_id))
    if not category:
        category = session.exec(
            select(Category).where(Category.slug == category_id)
        ).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    response = CategoryResponse.model_validate(category)
    response.event_count = len(category.events) if category.events else 0
    return response


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: str,
    category_data: CategoryUpdate,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Update a category (admin only).
    """
    category = session.get(Category, normalize_uuid(category_id))
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    # Update fields
    update_data = category_data.model_dump(exclude_unset=True)

    # Check for duplicate name/slug if being updated
    if "name" in update_data or "slug" in update_data:
        new_name = update_data.get("name", category.name)
        new_slug = update_data.get("slug", category.slug)

        existing = session.exec(
            select(Category).where(
                (Category.id != category.id) &
                ((Category.name == new_name) | (Category.slug == new_slug))
            )
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category with this name or slug already exists"
            )

    for field, value in update_data.items():
        setattr(category, field, value)

    category.updated_at = datetime.utcnow()

    session.add(category)
    session.commit()
    session.refresh(category)

    response = CategoryResponse.model_validate(category)
    response.event_count = len(category.events) if category.events else 0
    return response


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: str,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Delete a category (admin only).

    Fails if events are using this category.
    """
    category = session.get(Category, normalize_uuid(category_id))
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    # Check for events using this category
    if category.events and len(category.events) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete category with {len(category.events)} events. Reassign events first."
        )

    session.delete(category)
    session.commit()

    return None


# ============================================================
# CATEGORY FOLLOW ENDPOINTS
# ============================================================

from app.models.user_category_follow import UserCategoryFollow


# IMPORTANT: This route MUST be defined BEFORE any /{category_id}/* routes
# or FastAPI will match "/user/following" as "/{category_id}/following" with category_id="user"
@router.get("/user/following")
def get_followed_categories(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get all categories the current user follows."""
    follows = session.exec(
        select(UserCategoryFollow).where(
            UserCategoryFollow.user_id == current_user.id
        )
    ).all()
    
    category_ids = [f.category_id for f in follows]
    
    if not category_ids:
        return {"categories": [], "total": 0}
    
    categories = session.exec(
        select(Category).where(Category.id.in_(category_ids))
    ).all()
    
    return {
        "categories": [CategoryResponse.model_validate(c) for c in categories],
        "total": len(categories)
    }


@router.post("/{category_id}/follow", status_code=status.HTTP_201_CREATED)
def follow_category(
    category_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Follow a category for personalized feed."""
    normalized_id = normalize_uuid(category_id)
    
    # Check category exists
    category = session.get(Category, normalized_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    
    # Check if already following
    existing = session.exec(
        select(UserCategoryFollow).where(
            UserCategoryFollow.user_id == current_user.id,
            UserCategoryFollow.category_id == normalized_id
        )
    ).first()
    
    if existing:
        return {"message": "Already following this category"}
    
    # Create follow
    follow = UserCategoryFollow(
        user_id=current_user.id,
        category_id=normalized_id
    )
    session.add(follow)
    session.commit()
    
    return {"message": f"Now following {category.name}"}


@router.delete("/{category_id}/follow", status_code=status.HTTP_200_OK)
def unfollow_category(
    category_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Unfollow a category."""
    normalized_id = normalize_uuid(category_id)
    
    follow = session.exec(
        select(UserCategoryFollow).where(
            UserCategoryFollow.user_id == current_user.id,
            UserCategoryFollow.category_id == normalized_id
        )
    ).first()
    
    if not follow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not following this category"
        )
    
    session.delete(follow)
    session.commit()
    
    return {"message": "Unfollowed category"}


@router.get("/{category_id}/following")
def check_following(
    category_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Check if the current user follows a category."""
    normalized_id = normalize_uuid(category_id)
    
    follow = session.exec(
        select(UserCategoryFollow).where(
            UserCategoryFollow.user_id == current_user.id,
            UserCategoryFollow.category_id == normalized_id
        )
    ).first()
    
    return {"following": follow is not None}

