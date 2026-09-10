# Phase 2A Implementation Plan: Categories, Tags & Media

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add admin-controlled categories, user-generated tags, image uploads, and Mapbox geocoding to the Highland Events platform.

**Architecture:** Categories replace the existing EventCategory enum with a database-driven model. Tags are a many-to-many relationship with events via a junction table. Media uploads use a storage abstraction (local for dev, Cloudinary-ready for prod). Geocoding proxies through the backend to keep API tokens secure.

**Tech Stack:** FastAPI, SQLModel, Pillow (image processing), httpx (Mapbox API), React, TypeScript, Tailwind CSS

---

## Task 1: Category Model & Schema

**Files:**
- Create: `backend/app/models/category.py`
- Create: `backend/app/schemas/category.py`

**Step 1: Create Category model**

Create file `backend/app/models/category.py`:

```python
"""
Category model for event classification.
Admin-controlled categories with visual styling for homepage grid.
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING, List
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .event import Event


class Category(SQLModel, table=True):
    """
    Category model for classifying events.

    Attributes:
        id: Unique category identifier
        name: Display name (e.g., "Live Music")
        slug: URL-friendly name (e.g., "live-music")
        description: Optional description for SEO/tooltips
        image_url: Background image for category grid
        gradient_color: Hex color for gradient overlay
        display_order: Sort order in category grid
        is_active: Soft delete flag
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    __tablename__ = "categories"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    name: str = Field(max_length=100, unique=True, index=True)
    slug: str = Field(max_length=100, unique=True, index=True)
    description: Optional[str] = Field(default=None, max_length=500)
    image_url: Optional[str] = Field(default=None, max_length=500)
    gradient_color: str = Field(default="#6B7280", max_length=7)  # Default gray
    display_order: int = Field(default=0)
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    events: List["Event"] = Relationship(back_populates="category_rel")
```

**Step 2: Create Category schemas**

Create file `backend/app/schemas/category.py`:

```python
"""
Pydantic schemas for category-related API requests and responses.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
import re


def generate_slug(name: str) -> str:
    """Generate URL-friendly slug from name."""
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    return slug


class CategoryCreate(BaseModel):
    """Schema for creating a new category."""
    name: str = Field(min_length=1, max_length=100)
    slug: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    image_url: Optional[str] = Field(None, max_length=500)
    gradient_color: str = Field(default="#6B7280", max_length=7, pattern=r'^#[0-9A-Fa-f]{6}$')
    display_order: int = Field(default=0, ge=0)
    is_active: bool = Field(default=True)


class CategoryUpdate(BaseModel):
    """Schema for updating a category."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    slug: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    image_url: Optional[str] = Field(None, max_length=500)
    gradient_color: Optional[str] = Field(None, max_length=7, pattern=r'^#[0-9A-Fa-f]{6}$')
    display_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    """Schema for category response."""
    id: str
    name: str
    slug: str
    description: Optional[str]
    image_url: Optional[str]
    gradient_color: str
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    event_count: Optional[int] = None

    class Config:
        from_attributes = True


class CategoryListResponse(BaseModel):
    """Schema for category list response."""
    categories: list[CategoryResponse]
    total: int
```

**Step 3: Commit**

```bash
git add backend/app/models/category.py backend/app/schemas/category.py
git commit -m "feat: add Category model and schemas"
```

---

## Task 2: Category API Endpoints

**Files:**
- Create: `backend/app/api/categories.py`
- Modify: `backend/app/main.py`

**Step 1: Create Category API routes**

Create file `backend/app/api/categories.py`:

```python
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
```

**Step 2: Register categories router in main.py**

Modify `backend/app/main.py` - add import and router:

Add to imports:
```python
from app.api import auth, events, venues, checkins, gamification, promotions, categories
```

Add router registration (after promotions):
```python
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
```

**Step 3: Commit**

```bash
git add backend/app/api/categories.py backend/app/main.py
git commit -m "feat: add Category API endpoints"
```

---

## Task 3: Tag Model & Schema

**Files:**
- Create: `backend/app/models/tag.py`
- Create: `backend/app/schemas/tag.py`

**Step 1: Create Tag model with EventTag junction**

Create file `backend/app/models/tag.py`:

```python
"""
Tag model for user-generated event classification.
Includes EventTag junction table for many-to-many relationship.
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING, List
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship
import re

if TYPE_CHECKING:
    from .event import Event


def normalize_tag_name(name: str) -> str:
    """Normalize tag name: lowercase, hyphens for spaces, no special chars."""
    normalized = name.lower().strip()
    normalized = re.sub(r'[^\w\s-]', '', normalized)
    normalized = re.sub(r'[\s_]+', '-', normalized)
    return normalized


class EventTag(SQLModel, table=True):
    """Junction table for Event-Tag many-to-many relationship."""
    __tablename__ = "event_tags"

    event_id: str = Field(foreign_key="events.id", primary_key=True)
    tag_id: str = Field(foreign_key="tags.id", primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Tag(SQLModel, table=True):
    """
    Tag model for classifying events.

    Attributes:
        id: Unique tag identifier
        name: Normalized tag name (lowercase, hyphens)
        usage_count: Number of events using this tag
        created_at: Creation timestamp
    """
    __tablename__ = "tags"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    name: str = Field(max_length=50, unique=True, index=True)
    usage_count: int = Field(default=0, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    events: List["Event"] = Relationship(back_populates="tags", link_model=EventTag)
```

**Step 2: Create Tag schemas**

Create file `backend/app/schemas/tag.py`:

```python
"""
Pydantic schemas for tag-related API requests and responses.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class TagCreate(BaseModel):
    """Schema for creating tags (used internally)."""
    name: str = Field(min_length=1, max_length=50)


class TagResponse(BaseModel):
    """Schema for tag response."""
    id: str
    name: str
    usage_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class TagListResponse(BaseModel):
    """Schema for tag list response."""
    tags: list[TagResponse]
    total: int


class EventTagsUpdate(BaseModel):
    """Schema for updating event tags."""
    tags: List[str] = Field(max_length=5, description="List of tag names (max 5)")
```

**Step 3: Commit**

```bash
git add backend/app/models/tag.py backend/app/schemas/tag.py
git commit -m "feat: add Tag model and schemas with EventTag junction"
```

---

## Task 4: Tag API Endpoints

**Files:**
- Create: `backend/app/api/tags.py`
- Modify: `backend/app/main.py`

**Step 1: Create Tag API routes**

Create file `backend/app/api/tags.py`:

```python
"""
Tags API routes.
Handles tag listing and autocomplete.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.tag import Tag
from app.schemas.tag import TagResponse, TagListResponse

router = APIRouter(tags=["Tags"])


@router.get("", response_model=TagListResponse)
def list_tags(
    search: Optional[str] = Query(None, min_length=1, max_length=50),
    limit: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session)
):
    """
    List tags with optional search filter.

    Used for tag autocomplete in event forms.
    """
    query = select(Tag)

    if search:
        query = query.where(Tag.name.contains(search.lower()))

    query = query.order_by(Tag.usage_count.desc(), Tag.name).limit(limit)
    tags = session.exec(query).all()

    return TagListResponse(
        tags=[TagResponse.model_validate(t) for t in tags],
        total=len(tags)
    )


@router.get("/popular", response_model=TagListResponse)
def get_popular_tags(
    limit: int = Query(default=20, ge=1, le=50),
    session: Session = Depends(get_session)
):
    """
    Get most popular tags by usage count.

    Used for tag cloud display.
    """
    query = select(Tag).where(Tag.usage_count > 0).order_by(Tag.usage_count.desc()).limit(limit)
    tags = session.exec(query).all()

    return TagListResponse(
        tags=[TagResponse.model_validate(t) for t in tags],
        total=len(tags)
    )
```

**Step 2: Register tags router in main.py**

Modify `backend/app/main.py` - add import and router:

Add to imports:
```python
from app.api import auth, events, venues, checkins, gamification, promotions, categories, tags
```

Add router registration:
```python
app.include_router(tags.router, prefix="/api/tags", tags=["Tags"])
```

**Step 3: Commit**

```bash
git add backend/app/api/tags.py backend/app/main.py
git commit -m "feat: add Tag API endpoints for autocomplete and popular tags"
```

---

## Task 5: Update Event Model for Category FK and Tags

**Files:**
- Modify: `backend/app/models/event.py`
- Modify: `backend/app/models/__init__.py` (if exists)

**Step 1: Update Event model**

Modify `backend/app/models/event.py`:

Replace the EventCategory enum import and usage with Category relationship:

```python
"""
Event model representing events happening across the Highlands.
Includes geolocation, pricing, and featured status.
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING, List
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .user import User
    from .venue import Venue
    from .checkin import CheckIn
    from .category import Category
    from .tag import Tag, EventTag


class Event(SQLModel, table=True):
    """
    Event model representing a scheduled event.
    """
    __tablename__ = "events"

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    title: str = Field(max_length=255, index=True)
    description: str = Field(max_length=5000)

    # Dates
    date_start: datetime = Field(index=True)
    date_end: datetime = Field(index=True)

    # Location
    venue_id: str = Field(foreign_key="venues.id", index=True)
    latitude: float = Field(index=True)
    longitude: float = Field(index=True)
    geohash: Optional[str] = Field(default=None, max_length=12, index=True)

    # Classification - Now uses Category table
    category_id: Optional[str] = Field(default=None, foreign_key="categories.id", index=True)
    price: float = Field(default=0.0, ge=0.0)

    # Featured status (paid promotion)
    featured: bool = Field(default=False, index=True)
    featured_until: Optional[datetime] = Field(default=None)

    # Organizer
    organizer_id: str = Field(foreign_key="users.id", index=True)

    # Media
    image_url: Optional[str] = Field(default=None, max_length=500)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    venue: "Venue" = Relationship(back_populates="events")
    organizer: "User" = Relationship(back_populates="submitted_events")
    check_ins: List["CheckIn"] = Relationship(back_populates="event")
    category_rel: Optional["Category"] = Relationship(back_populates="events")
    tags: List["Tag"] = Relationship(back_populates="events", link_model="EventTag")
```

**Step 2: Commit**

```bash
git add backend/app/models/event.py
git commit -m "feat: update Event model with category_id FK and tags relationship"
```

---

## Task 6: Update Event Schemas for Category and Tags

**Files:**
- Modify: `backend/app/schemas/event.py`

**Step 1: Update Event schemas**

Replace `backend/app/schemas/event.py`:

```python
"""
Pydantic schemas for event-related API requests and responses.
Handles event creation, updates, filtering, and listings.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.schemas.category import CategoryResponse
from app.schemas.tag import TagResponse


class EventCreate(BaseModel):
    """Schema for creating a new event."""
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=5000)
    date_start: datetime
    date_end: datetime
    venue_id: str
    category_id: str  # Required - references Category table
    price: float = Field(default=0.0, ge=0.0)
    image_url: Optional[str] = Field(None, max_length=500)
    tags: Optional[List[str]] = Field(default=None, max_length=5)  # Tag names


class EventUpdate(BaseModel):
    """Schema for updating an existing event."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1, max_length=5000)
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    venue_id: Optional[str] = None
    category_id: Optional[str] = None
    price: Optional[float] = Field(None, ge=0.0)
    image_url: Optional[str] = Field(None, max_length=500)
    tags: Optional[List[str]] = Field(None, max_length=5)


class EventResponse(BaseModel):
    """Schema for event response with all details."""
    id: str
    title: str
    description: str
    date_start: datetime
    date_end: datetime
    venue_id: str
    latitude: float
    longitude: float
    geohash: Optional[str]
    category_id: Optional[str]
    price: float
    featured: bool
    featured_until: Optional[datetime]
    organizer_id: str
    image_url: Optional[str]
    created_at: datetime
    updated_at: datetime

    # Computed/nested fields
    venue_name: Optional[str] = None
    distance_km: Optional[float] = None
    checkin_count: Optional[int] = None
    category: Optional[CategoryResponse] = None
    tags: Optional[List[TagResponse]] = None

    class Config:
        from_attributes = True


class EventFilter(BaseModel):
    """Schema for filtering events."""
    category_id: Optional[str] = None  # Filter by category ID
    category_ids: Optional[List[str]] = None  # Filter by multiple categories
    tag_names: Optional[List[str]] = None  # Filter by tag names
    region: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    price_min: Optional[float] = Field(None, ge=0.0)
    price_max: Optional[float] = Field(None, ge=0.0)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = Field(None, ge=0.0)
    featured_only: Optional[bool] = False
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=100)


class EventListResponse(BaseModel):
    """Schema for paginated event list response."""
    events: list[EventResponse]
    total: int
    skip: int
    limit: int
```

**Step 2: Commit**

```bash
git add backend/app/schemas/event.py
git commit -m "feat: update Event schemas with category_id and tags"
```

---

## Task 7: Update Event API for Categories and Tags

**Files:**
- Modify: `backend/app/api/events.py`

**Step 1: Update events API**

Update `backend/app/api/events.py` to handle categories and tags:

```python
"""
Events API routes.
Handles event CRUD operations, filtering, and search.
"""
from datetime import datetime
from typing import Optional, List
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.utils import normalize_uuid
from app.models.user import User
from app.models.event import Event
from app.models.venue import Venue
from app.models.category import Category
from app.models.tag import Tag, EventTag, normalize_tag_name
from app.schemas.event import (
    EventCreate,
    EventUpdate,
    EventResponse,
    EventListResponse
)
from app.schemas.category import CategoryResponse
from app.schemas.tag import TagResponse
from app.services.geolocation import calculate_geohash, haversine_distance, get_bounding_box

router = APIRouter(tags=["Events"])


def get_or_create_tags(session: Session, tag_names: List[str]) -> List[Tag]:
    """Get existing tags or create new ones. Returns list of Tag objects."""
    tags = []
    for name in tag_names[:5]:  # Max 5 tags
        normalized = normalize_tag_name(name)
        if not normalized:
            continue

        tag = session.exec(select(Tag).where(Tag.name == normalized)).first()
        if not tag:
            tag = Tag(id=normalize_uuid(uuid4()), name=normalized)
            session.add(tag)
        tags.append(tag)

    return tags


def build_event_response(event: Event, session: Session, user_lat: float = None, user_lon: float = None) -> EventResponse:
    """Build EventResponse with computed fields."""
    # Get venue name
    venue = session.get(Venue, event.venue_id)
    venue_name = venue.name if venue else None

    # Calculate distance if coordinates provided
    distance_km = None
    if user_lat is not None and user_lon is not None:
        distance_km = haversine_distance(user_lat, user_lon, event.latitude, event.longitude)

    # Count check-ins
    checkin_count = len(event.check_ins) if event.check_ins else 0

    # Get category
    category_response = None
    if event.category_rel:
        category_response = CategoryResponse.model_validate(event.category_rel)

    # Get tags
    tag_responses = [TagResponse.model_validate(t) for t in event.tags] if event.tags else []

    response = EventResponse.model_validate(event)
    response.venue_name = venue_name
    response.distance_km = distance_km
    response.checkin_count = checkin_count
    response.category = category_response
    response.tags = tag_responses

    return response


@router.get("", response_model=EventListResponse)
def list_events(
    category_id: Optional[str] = None,
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs"),
    tag_names: Optional[str] = Query(None, description="Comma-separated tag names"),
    region: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: Optional[float] = None,
    featured_only: bool = False,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    session: Session = Depends(get_session)
):
    """
    List events with optional filtering.
    """
    query = select(Event)

    # Filter by single category
    if category_id:
        query = query.where(Event.category_id == normalize_uuid(category_id))

    # Filter by multiple categories
    if category_ids:
        cat_id_list = [normalize_uuid(cid.strip()) for cid in category_ids.split(",")]
        query = query.where(Event.category_id.in_(cat_id_list))

    # Filter by tags
    if tag_names:
        tag_list = [normalize_tag_name(t.strip()) for t in tag_names.split(",")]
        # Join with EventTag and Tag to filter
        query = query.join(EventTag, Event.id == EventTag.event_id).join(
            Tag, EventTag.tag_id == Tag.id
        ).where(Tag.name.in_(tag_list))

    # Filter by date range
    if date_from:
        query = query.where(Event.date_start >= date_from)
    if date_to:
        query = query.where(Event.date_end <= date_to)

    # Filter by price range
    if price_min is not None:
        query = query.where(Event.price >= price_min)
    if price_max is not None:
        query = query.where(Event.price <= price_max)

    # Filter by featured status
    if featured_only:
        query = query.where(Event.featured == True)
        query = query.where((Event.featured_until == None) | (Event.featured_until > datetime.utcnow()))

    # Filter by geographic proximity
    if latitude is not None and longitude is not None and radius_km is not None:
        min_lat, max_lat, min_lon, max_lon = get_bounding_box(latitude, longitude, radius_km)
        query = query.where(
            Event.latitude.between(min_lat, max_lat),
            Event.longitude.between(min_lon, max_lon)
        )

    # Order by: featured first, then by date
    query = query.order_by(Event.featured.desc(), Event.date_start)

    # Count total (distinct to handle tag joins)
    count_query = select(func.count(func.distinct(Event.id))).select_from(query.subquery())
    total = session.exec(count_query).one()

    # Apply pagination with distinct
    query = query.distinct().offset(skip).limit(limit)
    events = session.exec(query).all()

    # Build responses
    event_responses = [
        build_event_response(event, session, latitude, longitude)
        for event in events
    ]

    return EventListResponse(
        events=event_responses,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event_data: EventCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Create a new event.
    """
    # Validate venue
    venue_id_normalized = normalize_uuid(event_data.venue_id)
    venue = session.get(Venue, venue_id_normalized)
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found"
        )

    # Validate category
    category_id_normalized = normalize_uuid(event_data.category_id)
    category = session.get(Category, category_id_normalized)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    # Use venue coordinates
    latitude = venue.latitude
    longitude = venue.longitude
    geohash = calculate_geohash(latitude, longitude)

    # Create event
    new_event = Event(
        id=normalize_uuid(uuid4()),
        title=event_data.title,
        description=event_data.description,
        date_start=event_data.date_start,
        date_end=event_data.date_end,
        venue_id=venue_id_normalized,
        latitude=latitude,
        longitude=longitude,
        geohash=geohash,
        category_id=category_id_normalized,
        price=event_data.price,
        image_url=event_data.image_url,
        organizer_id=normalize_uuid(current_user.id)
    )

    session.add(new_event)
    session.flush()  # Get the event ID

    # Handle tags
    if event_data.tags:
        tags = get_or_create_tags(session, event_data.tags)
        for tag in tags:
            event_tag = EventTag(event_id=new_event.id, tag_id=tag.id)
            session.add(event_tag)
            tag.usage_count += 1

    session.commit()
    session.refresh(new_event)

    return build_event_response(new_event, session)


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: str,
    session: Session = Depends(get_session)
):
    """
    Get a specific event by ID.
    """
    event = session.get(Event, normalize_uuid(event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    return build_event_response(event, session)


@router.put("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: str,
    event_data: EventUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Update an existing event.
    """
    event = session.get(Event, normalize_uuid(event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # Check permissions
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this event"
        )

    # Update fields
    update_data = event_data.model_dump(exclude_unset=True, exclude={"tags"})

    # Validate category if being updated
    if "category_id" in update_data:
        category = session.get(Category, normalize_uuid(update_data["category_id"]))
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found"
            )
        update_data["category_id"] = normalize_uuid(update_data["category_id"])

    for field, value in update_data.items():
        if field == "venue_id":
            value = normalize_uuid(value)
        setattr(event, field, value)

    # Update geohash if venue changed
    if "venue_id" in update_data:
        venue = session.get(Venue, event.venue_id)
        if venue:
            event.latitude = venue.latitude
            event.longitude = venue.longitude
            event.geohash = calculate_geohash(venue.latitude, venue.longitude)

    # Handle tags update
    if event_data.tags is not None:
        # Remove old tags and decrement counts
        old_event_tags = session.exec(
            select(EventTag).where(EventTag.event_id == event.id)
        ).all()
        for et in old_event_tags:
            old_tag = session.get(Tag, et.tag_id)
            if old_tag and old_tag.usage_count > 0:
                old_tag.usage_count -= 1
            session.delete(et)

        # Add new tags
        if event_data.tags:
            new_tags = get_or_create_tags(session, event_data.tags)
            for tag in new_tags:
                event_tag = EventTag(event_id=event.id, tag_id=tag.id)
                session.add(event_tag)
                tag.usage_count += 1

    event.updated_at = datetime.utcnow()

    session.add(event)
    session.commit()
    session.refresh(event)

    return build_event_response(event, session)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Delete an event.
    """
    event = session.get(Event, normalize_uuid(event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # Check permissions
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this event"
        )

    # Decrement tag usage counts
    event_tags = session.exec(
        select(EventTag).where(EventTag.event_id == event.id)
    ).all()
    for et in event_tags:
        tag = session.get(Tag, et.tag_id)
        if tag and tag.usage_count > 0:
            tag.usage_count -= 1
        session.delete(et)

    session.delete(event)
    session.commit()

    return None
```

**Step 2: Commit**

```bash
git add backend/app/api/events.py
git commit -m "feat: update Events API with category and tag filtering"
```

---

## Task 8: Update Venue Model for Image and Formatted Address

**Files:**
- Modify: `backend/app/models/venue.py`
- Modify: `backend/app/schemas/venue.py`

**Step 1: Update Venue model**

Add to `backend/app/models/venue.py` after the `phone` field:

```python
    # Media
    image_url: Optional[str] = Field(default=None, max_length=500)

    # Geocoded address
    formatted_address: Optional[str] = Field(default=None, max_length=500)
```

**Step 2: Update Venue schemas**

Update `backend/app/schemas/venue.py` to include new fields in VenueCreate, VenueUpdate, and VenueResponse.

**Step 3: Commit**

```bash
git add backend/app/models/venue.py backend/app/schemas/venue.py
git commit -m "feat: add image_url and formatted_address to Venue model"
```

---

## Task 9: Media Upload Service (Local Storage)

**Files:**
- Create: `backend/app/services/media.py`
- Create: `backend/app/api/media.py`
- Modify: `backend/app/main.py`
- Create: `backend/static/uploads/.gitkeep`

**Step 1: Create media service**

Create file `backend/app/services/media.py`:

```python
"""
Media storage service with local file storage.
Designed for easy swap to Cloudinary in production.
"""
import os
import uuid
from pathlib import Path
from typing import Optional, Tuple
from PIL import Image
from io import BytesIO
from fastapi import UploadFile, HTTPException

from app.core.config import settings


# Image size variants
IMAGE_SIZES = {
    "thumbnail": (320, 180),
    "medium": (640, 360),
    "large": (1280, 720),
}

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def get_upload_dir(folder: str) -> Path:
    """Get upload directory path, creating if needed."""
    base_dir = Path(settings.UPLOAD_DIR if hasattr(settings, 'UPLOAD_DIR') else "static/uploads")
    upload_dir = base_dir / folder
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def validate_image(file: UploadFile) -> None:
    """Validate uploaded image file."""
    # Check extension
    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Check content type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")


def generate_image_variants(image: Image.Image, upload_dir: Path, base_name: str) -> dict:
    """Generate thumbnail, medium, and large variants of an image."""
    urls = {}

    for size_name, dimensions in IMAGE_SIZES.items():
        resized = image.copy()
        resized.thumbnail(dimensions, Image.Resampling.LANCZOS)

        filename = f"{base_name}_{size_name}.webp"
        filepath = upload_dir / filename
        resized.save(filepath, "WEBP", quality=85)

        urls[f"{size_name}_url"] = f"/static/uploads/{upload_dir.name}/{filename}"

    return urls


async def upload_image(file: UploadFile, folder: str) -> dict:
    """
    Upload an image and generate size variants.

    Returns dict with url, thumbnail_url, medium_url, large_url
    """
    validate_image(file)

    # Read file content
    content = await file.read()

    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 5MB.")

    # Open and process image
    try:
        image = Image.open(BytesIO(content))
        image = image.convert("RGB")  # Ensure RGB for WebP
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Generate unique filename
    file_id = str(uuid.uuid4()).replace("-", "")
    upload_dir = get_upload_dir(folder)

    # Save original as WebP
    original_filename = f"{file_id}_original.webp"
    original_path = upload_dir / original_filename
    image.save(original_path, "WEBP", quality=90)

    # Generate variants
    urls = generate_image_variants(image, upload_dir, file_id)
    urls["url"] = f"/static/uploads/{folder}/{original_filename}"

    return urls


def delete_image(url: str) -> bool:
    """Delete an image and all its variants."""
    if not url or not url.startswith("/static/uploads/"):
        return False

    # Extract folder and base filename
    parts = url.replace("/static/uploads/", "").split("/")
    if len(parts) != 2:
        return False

    folder, filename = parts
    base_name = filename.rsplit("_", 1)[0]  # Remove _original.webp

    upload_dir = get_upload_dir(folder)

    # Delete all variants
    deleted = False
    for suffix in ["original", "thumbnail", "medium", "large"]:
        filepath = upload_dir / f"{base_name}_{suffix}.webp"
        if filepath.exists():
            filepath.unlink()
            deleted = True

    return deleted
```

**Step 2: Create media API routes**

Create file `backend/app/api/media.py`:

```python
"""
Media upload API routes.
"""
from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException
from app.core.security import get_current_user
from app.models.user import User
from app.services.media import upload_image, delete_image

router = APIRouter(tags=["Media"])


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    folder: str = Query(..., regex="^(events|venues|categories)$"),
    current_user: User = Depends(get_current_user)
):
    """
    Upload an image file.

    Folder must be one of: events, venues, categories
    Returns URLs for original and size variants.
    """
    urls = await upload_image(file, folder)
    return urls


@router.delete("/{folder}/{filename}")
async def delete_media(
    folder: str,
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete an uploaded image and its variants.
    """
    url = f"/static/uploads/{folder}/{filename}"
    success = delete_image(url)

    if not success:
        raise HTTPException(status_code=404, detail="Image not found")

    return {"deleted": True}
```

**Step 3: Update main.py for static files and media router**

Add to `backend/app/main.py`:

```python
from fastapi.staticfiles import StaticFiles
from app.api import media

# Mount static files (after app creation)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Add router
app.include_router(media.router, prefix="/api/media", tags=["Media"])
```

**Step 4: Create upload directories**

```bash
mkdir -p backend/static/uploads/events
mkdir -p backend/static/uploads/venues
mkdir -p backend/static/uploads/categories
touch backend/static/uploads/.gitkeep
```

**Step 5: Add Pillow to requirements.txt**

```
Pillow>=10.0.0
```

**Step 6: Commit**

```bash
git add backend/app/services/media.py backend/app/api/media.py backend/app/main.py backend/static/ backend/requirements.txt
git commit -m "feat: add media upload service with local storage and image variants"
```

---

## Task 10: Mapbox Geocoding Service

**Files:**
- Create: `backend/app/services/geocoding.py`
- Create: `backend/app/api/geocode.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/main.py`

**Step 1: Update config with Mapbox token**

Add to `backend/app/core/config.py` Settings class:

```python
    # Mapbox
    MAPBOX_ACCESS_TOKEN: Optional[str] = None
```

**Step 2: Create geocoding service**

Create file `backend/app/services/geocoding.py`:

```python
"""
Mapbox geocoding service for address lookup and validation.
"""
import httpx
from typing import List, Optional
from pydantic import BaseModel

from app.core.config import settings


class GeocodeSuggestion(BaseModel):
    """A geocoding suggestion from Mapbox."""
    place_name: str
    latitude: float
    longitude: float
    relevance: float


async def search_address(query: str, limit: int = 5) -> List[GeocodeSuggestion]:
    """
    Search for addresses using Mapbox Geocoding API.

    Returns list of suggestions with coordinates.
    """
    if not settings.MAPBOX_ACCESS_TOKEN:
        return []

    # Focus search on Scottish Highlands region
    bbox = f"{settings.HIGHLANDS_LON_MIN},{settings.HIGHLANDS_LAT_MIN},{settings.HIGHLANDS_LON_MAX},{settings.HIGHLANDS_LAT_MAX}"

    url = "https://api.mapbox.com/geocoding/v5/mapbox.places/{}.json".format(
        query.replace(" ", "%20")
    )

    params = {
        "access_token": settings.MAPBOX_ACCESS_TOKEN,
        "limit": limit,
        "bbox": bbox,
        "country": "GB",
        "types": "address,poi,place"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)

        if response.status_code != 200:
            return []

        data = response.json()
        suggestions = []

        for feature in data.get("features", []):
            coords = feature.get("geometry", {}).get("coordinates", [])
            if len(coords) >= 2:
                suggestions.append(GeocodeSuggestion(
                    place_name=feature.get("place_name", ""),
                    longitude=coords[0],
                    latitude=coords[1],
                    relevance=feature.get("relevance", 0)
                ))

        return suggestions


def validate_highland_region(lat: float, lng: float) -> bool:
    """Check if coordinates are within the Highland region."""
    return (
        settings.HIGHLANDS_LAT_MIN <= lat <= settings.HIGHLANDS_LAT_MAX and
        settings.HIGHLANDS_LON_MIN <= lng <= settings.HIGHLANDS_LON_MAX
    )
```

**Step 3: Create geocode API routes**

Create file `backend/app/api/geocode.py`:

```python
"""
Geocoding API routes.
Proxies requests to Mapbox to keep API token server-side.
"""
from fastapi import APIRouter, Query, HTTPException
from typing import List

from app.services.geocoding import search_address, GeocodeSuggestion, validate_highland_region

router = APIRouter(tags=["Geocoding"])


@router.get("/search", response_model=List[GeocodeSuggestion])
async def geocode_search(
    q: str = Query(..., min_length=3, max_length=200, description="Search query")
):
    """
    Search for addresses using Mapbox Geocoding.

    Returns list of suggestions with coordinates.
    Focused on Scottish Highlands region.
    """
    suggestions = await search_address(q)
    return suggestions


@router.get("/validate")
async def validate_location(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180)
):
    """
    Validate that coordinates are within the Highland region.
    """
    is_valid = validate_highland_region(lat, lng)
    return {
        "valid": is_valid,
        "message": "Location is within the Highlands" if is_valid else "Location is outside the Highlands region"
    }
```

**Step 4: Register geocode router**

Add to `backend/app/main.py`:

```python
from app.api import geocode

app.include_router(geocode.router, prefix="/api/geocode", tags=["Geocoding"])
```

**Step 5: Add httpx to requirements.txt**

```
httpx>=0.25.0
```

**Step 6: Commit**

```bash
git add backend/app/services/geocoding.py backend/app/api/geocode.py backend/app/core/config.py backend/app/main.py backend/requirements.txt
git commit -m "feat: add Mapbox geocoding service and API proxy"
```

---

## Task 11: Database Migration & Seed Default Categories

**Files:**
- Modify: `backend/seeds/seed_data.py`

**Step 1: Update seed script with categories**

Add category seeding to `backend/seeds/seed_data.py`:

```python
# Add to imports
from app.models.category import Category

# Add DEFAULT_CATEGORIES constant
DEFAULT_CATEGORIES = [
    {"name": "Music", "slug": "music", "gradient_color": "#8B5CF6", "display_order": 1},
    {"name": "Festival", "slug": "festival", "gradient_color": "#F59E0B", "display_order": 2},
    {"name": "Community", "slug": "community", "gradient_color": "#10B981", "display_order": 3},
    {"name": "Food & Drink", "slug": "food-drink", "gradient_color": "#EF4444", "display_order": 4},
    {"name": "Sports", "slug": "sports", "gradient_color": "#3B82F6", "display_order": 5},
    {"name": "Arts & Culture", "slug": "arts-culture", "gradient_color": "#EC4899", "display_order": 6},
    {"name": "Family", "slug": "family", "gradient_color": "#14B8A6", "display_order": 7},
    {"name": "Nightlife", "slug": "nightlife", "gradient_color": "#6366F1", "display_order": 8},
    {"name": "Markets", "slug": "markets", "gradient_color": "#F97316", "display_order": 9},
    {"name": "Outdoor", "slug": "outdoor", "gradient_color": "#22C55E", "display_order": 10},
    {"name": "Tours", "slug": "tours", "gradient_color": "#0EA5E9", "display_order": 11},
    {"name": "Other", "slug": "other", "gradient_color": "#6B7280", "display_order": 12},
]

# Add seed_categories function
def seed_categories(session: Session) -> dict:
    """Seed default categories."""
    categories = {}

    for cat_data in DEFAULT_CATEGORIES:
        existing = session.exec(
            select(Category).where(Category.slug == cat_data["slug"])
        ).first()

        if not existing:
            category = Category(
                id=str(uuid4()).replace("-", ""),
                name=cat_data["name"],
                slug=cat_data["slug"],
                gradient_color=cat_data["gradient_color"],
                display_order=cat_data["display_order"],
                is_active=True
            )
            session.add(category)
            categories[cat_data["slug"]] = category
        else:
            categories[cat_data["slug"]] = existing

    session.commit()
    return categories

# Call seed_categories() in main seed function
```

**Step 2: Commit**

```bash
git add backend/seeds/seed_data.py
git commit -m "feat: add default category seeding"
```

---

## Task 12: Frontend - Category Types

**Files:**
- Modify: `frontend/src/types/index.ts`

**Step 1: Add Category and Tag types**

Add to `frontend/src/types/index.ts`:

```typescript
// ============================================================
// CATEGORY TYPES
// ============================================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  gradient_color: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  event_count?: number;
}

export interface CategoryListResponse {
  categories: Category[];
  total: number;
}

// ============================================================
// TAG TYPES
// ============================================================

export interface Tag {
  id: string;
  name: string;
  usage_count: number;
  created_at: string;
}

export interface TagListResponse {
  tags: Tag[];
  total: number;
}
```

Update EventResponse and EventCreate interfaces:

```typescript
export interface EventResponse extends Event {
  venue_name?: string;
  distance_km?: number;
  checkin_count?: number;
  category?: Category;  // Add this
  tags?: Tag[];          // Add this
}

export interface EventCreate {
  title: string;
  description?: string;
  date_start: string;
  date_end: string;
  venue_id: string;
  category_id: string;  // Changed from category: EventCategory
  price?: number;
  image_url?: string;
  tags?: string[];       // Add this
}
```

**Step 2: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add Category and Tag types to frontend"
```

---

## Task 13: Frontend - API Client Updates

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add category and tag API methods**

Add to `frontend/src/lib/api.ts`:

```typescript
// Categories API
categories: {
  list: async (activeOnly = true): Promise<CategoryListResponse> => {
    const response = await api.get(`/categories?active_only=${activeOnly}`);
    return response.data;
  },

  get: async (idOrSlug: string): Promise<Category> => {
    const response = await api.get(`/categories/${idOrSlug}`);
    return response.data;
  },

  create: async (data: Partial<Category>): Promise<Category> => {
    const response = await api.post('/categories', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Category>): Promise<Category> => {
    const response = await api.put(`/categories/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/categories/${id}`);
  }
},

// Tags API
tags: {
  list: async (search?: string, limit = 20): Promise<TagListResponse> => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('limit', String(limit));
    const response = await api.get(`/tags?${params}`);
    return response.data;
  },

  popular: async (limit = 20): Promise<TagListResponse> => {
    const response = await api.get(`/tags/popular?limit=${limit}`);
    return response.data;
  }
},

// Media API
media: {
  upload: async (file: File, folder: 'events' | 'venues' | 'categories'): Promise<{
    url: string;
    thumbnail_url: string;
    medium_url: string;
    large_url: string;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/media/upload?folder=${folder}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  delete: async (folder: string, filename: string): Promise<void> => {
    await api.delete(`/media/${folder}/${filename}`);
  }
},

// Geocoding API
geocode: {
  search: async (query: string): Promise<Array<{
    place_name: string;
    latitude: number;
    longitude: number;
    relevance: number;
  }>> => {
    const response = await api.get(`/geocode/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  validate: async (lat: number, lng: number): Promise<{ valid: boolean; message: string }> => {
    const response = await api.get(`/geocode/validate?lat=${lat}&lng=${lng}`);
    return response.data;
  }
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add category, tag, media, and geocode API methods"
```

---

## Task 14: Frontend - CategoryGrid Component

**Files:**
- Create: `frontend/src/components/categories/CategoryGrid.tsx`

**Step 1: Create CategoryGrid component**

Create file `frontend/src/components/categories/CategoryGrid.tsx`:

```tsx
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Category } from '@/types';
import { api } from '@/lib/api';

export default function CategoryGrid() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.categories.list();
        setCategories(response.categories);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="aspect-video bg-gray-200 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <section className="py-8">
      <h2 className="text-2xl font-bold mb-6">Browse by Category</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/events?category=${category.slug}`}
            className="group relative aspect-video rounded-lg overflow-hidden"
          >
            {/* Background Image */}
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform group-hover:scale-110"
              style={{
                backgroundImage: category.image_url
                  ? `url(${category.image_url})`
                  : 'url(/images/category-placeholder.jpg)',
              }}
            />

            {/* Gradient Overlay */}
            <div
              className="absolute inset-0 opacity-70 group-hover:opacity-80 transition-opacity"
              style={{
                background: `linear-gradient(to top, ${category.gradient_color}, transparent)`,
              }}
            />

            {/* Category Name */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-white font-semibold text-lg drop-shadow-lg">
                {category.name}
              </h3>
              {category.event_count !== undefined && category.event_count > 0 && (
                <p className="text-white/80 text-sm">
                  {category.event_count} event{category.event_count !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/categories/CategoryGrid.tsx
git commit -m "feat: add CategoryGrid component for homepage"
```

---

## Task 15: Frontend - TagInput Component

**Files:**
- Create: `frontend/src/components/tags/TagInput.tsx`

**Step 1: Create TagInput component**

Create file `frontend/src/components/tags/TagInput.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';
import { Tag } from '@/types';
import { api } from '@/lib/api';

interface TagInputProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

export default function TagInput({ selectedTags, onChange, maxTags = 5 }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (inputValue.length < 2) {
      setSuggestions([]);
      return;
    }

    // Debounce API calls
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.tags.list(inputValue);
        setSuggestions(response.tags.filter(t => !selectedTags.includes(t.name)));
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [inputValue, selectedTags]);

  const addTag = (tagName: string) => {
    const normalized = tagName.toLowerCase().trim().replace(/\s+/g, '-');
    if (normalized && !selectedTags.includes(normalized) && selectedTags.length < maxTags) {
      onChange([...selectedTags, normalized]);
    }
    setInputValue('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const removeTag = (tagName: string) => {
    onChange(selectedTags.filter(t => t !== tagName));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Tags (max {maxTags})
      </label>

      <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-white min-h-[42px]">
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-purple-600"
            >
              &times;
            </button>
          </span>
        ))}

        {selectedTags.length < maxTags && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={selectedTags.length === 0 ? "Add tags..." : ""}
            className="flex-1 min-w-[100px] outline-none text-sm"
          />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => addTag(tag.name)}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex justify-between items-center"
            >
              <span>{tag.name}</span>
              <span className="text-gray-400 text-sm">{tag.usage_count} uses</span>
            </button>
          ))}
        </div>
      )}

      {selectedTags.length >= maxTags && (
        <p className="text-sm text-amber-600 mt-1">Maximum {maxTags} tags reached</p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/tags/TagInput.tsx
git commit -m "feat: add TagInput component with autocomplete"
```

---

## Task 16: Frontend - TagCloud Component

**Files:**
- Create: `frontend/src/components/tags/TagCloud.tsx`

**Step 1: Create TagCloud component**

Create file `frontend/src/components/tags/TagCloud.tsx`:

```tsx
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag } from '@/types';
import { api } from '@/lib/api';

interface TagCloudProps {
  limit?: number;
}

export default function TagCloud({ limit = 20 }: TagCloudProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await api.tags.popular(limit);
        setTags(response.tags);
      } catch (error) {
        console.error('Failed to fetch popular tags:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, [limit]);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-8 w-20 bg-gray-200 animate-pulse rounded-full" />
        ))}
      </div>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  // Calculate font sizes based on usage count
  const maxCount = Math.max(...tags.map(t => t.usage_count));
  const minCount = Math.min(...tags.map(t => t.usage_count));
  const range = maxCount - minCount || 1;

  const getFontSize = (count: number) => {
    const normalized = (count - minCount) / range;
    return 0.75 + normalized * 0.5; // 0.75rem to 1.25rem
  };

  return (
    <section className="py-6">
      <h2 className="text-xl font-semibold mb-4">Popular Tags</h2>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Link
            key={tag.id}
            href={`/events?tags=${tag.name}`}
            className="px-3 py-1 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-800 rounded-full transition-colors"
            style={{ fontSize: `${getFontSize(tag.usage_count)}rem` }}
          >
            {tag.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/tags/TagCloud.tsx
git commit -m "feat: add TagCloud component for popular tags display"
```

---

## Task 17: Frontend - ImageUpload Component

**Files:**
- Create: `frontend/src/components/common/ImageUpload.tsx`

**Step 1: Create ImageUpload component**

Create file `frontend/src/components/common/ImageUpload.tsx`:

```tsx
import { useState, useRef } from 'react';
import { api } from '@/lib/api';

interface ImageUploadProps {
  folder: 'events' | 'venues' | 'categories';
  currentImageUrl?: string;
  onUpload: (urls: { url: string; thumbnail_url: string; medium_url: string }) => void;
  onRemove?: () => void;
  aspectRatio?: string;
}

export default function ImageUpload({
  folder,
  currentImageUrl,
  onUpload,
  onRemove,
  aspectRatio = '16/9'
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setError(null);
    setUploading(true);

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const urls = await api.media.upload(file, folder);
      onUpload(urls);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed');
      setPreview(currentImageUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
    onRemove?.();
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Featured Image
      </label>

      {preview ? (
        <div className="relative" style={{ aspectRatio }}>
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover rounded-lg"
          />
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
              <div className="text-white">Uploading...</div>
            </div>
          )}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-purple-400 transition-colors"
          style={{ aspectRatio }}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-600">Click to upload image</p>
            <p className="text-sm text-gray-400 mt-1">PNG, JPG, WebP up to 5MB</p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/common/ImageUpload.tsx
git commit -m "feat: add ImageUpload component with drag-drop and preview"
```

---

## Task 18: Frontend - AddressAutocomplete Component

**Files:**
- Create: `frontend/src/components/common/AddressAutocomplete.tsx`

**Step 1: Create AddressAutocomplete component**

Create file `frontend/src/components/common/AddressAutocomplete.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

interface AddressSuggestion {
  place_name: string;
  latitude: number;
  longitude: number;
  relevance: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an address..."
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (value.length < 3) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await api.geocode.search(value);
        setSuggestions(results);
      } catch (error) {
        console.error('Geocoding failed:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [value]);

  const handleSelect = (suggestion: AddressSuggestion) => {
    onChange(suggestion.place_name);
    onSelect(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Address
      </label>

      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />

        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
            >
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm text-gray-700">{suggestion.place_name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/common/AddressAutocomplete.tsx
git commit -m "feat: add AddressAutocomplete component with Mapbox integration"
```

---

## Task 19: Frontend - Update Homepage with CategoryGrid

**Files:**
- Modify: `frontend/src/pages/index.tsx`

**Step 1: Add CategoryGrid to homepage**

Import and add the CategoryGrid component to the homepage, positioned below the hero section.

**Step 2: Commit**

```bash
git add frontend/src/pages/index.tsx
git commit -m "feat: add CategoryGrid to homepage"
```

---

## Task 20: Frontend - Update Event Forms

**Files:**
- Modify: `frontend/src/pages/submit-event.tsx`

**Step 1: Update submit-event form with category dropdown and tag input**

Replace category enum select with a dropdown fetching from /api/categories. Add TagInput component for tags. Add ImageUpload component.

**Step 2: Commit**

```bash
git add frontend/src/pages/submit-event.tsx
git commit -m "feat: update event form with category select, tags, and image upload"
```

---

## Task 21: Frontend - Update Event List Filters

**Files:**
- Modify: `frontend/src/components/events/EventFilters.tsx`

**Step 1: Update filters with category and tag options**

Add category multi-select using categories from API. Add tag autocomplete filter. Add distance filter dropdown (5km, 10km, 20km, 50km).

**Step 2: Commit**

```bash
git add frontend/src/components/events/EventFilters.tsx
git commit -m "feat: update EventFilters with category, tag, and distance filters"
```

---

## Task 22: Final Integration Test

**Steps:**

1. Start backend:
```bash
cd backend
.venv/Scripts/activate
uvicorn app.main:app --reload --port 8003
```

2. Start frontend:
```bash
cd frontend
npm run dev
```

3. Test category CRUD via API
4. Test tag autocomplete
5. Test image upload
6. Test event creation with new fields
7. Test event filtering by category and tags
8. Test geocoding search

**Step: Final commit**

```bash
git add .
git commit -m "feat: complete Phase 2A - categories, tags, media, and geocoding"
```

---

## Summary

This plan implements:

- **Category System**: Full CRUD for admin-controlled categories with visual grid on homepage
- **Tag System**: User-generated tags with autocomplete and popular tags cloud
- **Media Upload**: Local storage with image variants, Cloudinary-ready architecture
- **Geocoding**: Mapbox integration for address autocomplete
- **Updated Events API**: Category filtering, tag filtering, distance filtering
- **Frontend Components**: CategoryGrid, TagInput, TagCloud, ImageUpload, AddressAutocomplete

**Total commits:** ~22
**Files changed:** ~35
