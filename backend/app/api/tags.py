"""
Tags API routes.
Handles tag listing, autocomplete, and admin management.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.utils import normalize_uuid
from app.models.user import User
from app.models.tag import Tag, EventTag
from app.schemas.tag import TagResponse, TagListResponse

router = APIRouter(tags=["Tags"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that requires admin privileges."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


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


# ============================================================
# Admin Endpoints
# ============================================================

class TagMergeRequest(BaseModel):
    """Request body for merging tags."""
    source_tag_id: str
    target_tag_id: str


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(
    tag_id: str,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Delete a tag (admin only).

    Events using this tag will lose the association.
    """
    tag = session.get(Tag, normalize_uuid(tag_id))
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Delete all event-tag associations
    event_tags = session.exec(
        select(EventTag).where(EventTag.tag_id == tag.id)
    ).all()
    for et in event_tags:
        session.delete(et)

    session.delete(tag)
    session.commit()
    return None


@router.post("/merge", response_model=TagResponse)
def merge_tags(
    data: TagMergeRequest,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Merge source tag into target tag (admin only).

    All events with source tag will be updated to use target tag.
    Source tag will be deleted.
    """
    source = session.get(Tag, normalize_uuid(data.source_tag_id))
    target = session.get(Tag, normalize_uuid(data.target_tag_id))

    if not source:
        raise HTTPException(status_code=404, detail="Source tag not found")
    if not target:
        raise HTTPException(status_code=404, detail="Target tag not found")
    if source.id == target.id:
        raise HTTPException(status_code=400, detail="Cannot merge tag with itself")

    # Find events with source tag
    source_event_tags = session.exec(
        select(EventTag).where(EventTag.tag_id == source.id)
    ).all()

    for et in source_event_tags:
        # Check if event already has target tag
        existing = session.exec(
            select(EventTag).where(
                EventTag.event_id == et.event_id,
                EventTag.tag_id == target.id
            )
        ).first()

        if not existing:
            # Add target tag to event
            new_et = EventTag(event_id=et.event_id, tag_id=target.id)
            session.add(new_et)
            target.usage_count += 1

        # Remove source tag association
        session.delete(et)

    # Delete source tag
    session.delete(source)
    session.commit()
    session.refresh(target)

    return TagResponse.model_validate(target)
