"""
Notifications API routes.
Handles fetching and managing user notification history.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, desc, func

from app.core.database import get_session
from app.models.user import User
from app.models.notification import Notification, NotificationType
from app.api.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# ============================================================
# Response Schemas
# ============================================================

class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    link: Optional[str]
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    unread_count: int


# ============================================================
# Endpoints
# ============================================================

@router.get("", response_model=NotificationListResponse)
def get_notifications(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    unread_only: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get current user's notifications.
    Returns paginated list with unread count.
    """
    # Base query
    query = select(Notification).where(Notification.user_id == current_user.id)

    if unread_only:
        query = query.where(Notification.is_read == False)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = session.exec(count_query).one()

    # Get unread count
    unread_query = select(func.count(Notification.id)).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    )
    unread_count = session.exec(unread_query).one()

    # Apply ordering and pagination
    query = query.order_by(desc(Notification.created_at)).offset(skip).limit(limit)
    notifications = session.exec(query).all()

    return NotificationListResponse(
        notifications=[
            NotificationResponse(
                id=n.id,
                type=n.type.value,
                title=n.title,
                message=n.message,
                link=n.link,
                is_read=n.is_read,
                created_at=n.created_at,
            )
            for n in notifications
        ],
        total=total or 0,
        unread_count=unread_count or 0,
    )


@router.post("/{notification_id}/read")
def mark_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Mark a notification as read."""
    notification = session.get(Notification, notification_id)

    if not notification or notification.user_id != current_user.id:
        return {"success": False, "message": "Notification not found"}

    notification.is_read = True
    session.add(notification)
    session.commit()

    return {"success": True}


@router.post("/read-all")
def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Mark all notifications as read."""
    notifications = session.exec(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        )
    ).all()

    for n in notifications:
        n.is_read = True
        session.add(n)

    session.commit()

    return {"success": True, "marked_count": len(notifications)}


# ============================================================
# Helper Functions (for use by other services)
# ============================================================

def create_notification(
    session: Session,
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    link: Optional[str] = None
) -> Notification:
    """
    Create a new notification for a user.
    Called by other services (moderation, venue claims, etc.)
    """
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        link=link,
    )
    session.add(notification)
    session.commit()
    session.refresh(notification)
    return notification
