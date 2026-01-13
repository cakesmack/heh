from datetime import datetime
from typing import List, Optional
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel

from app.core.database import get_session
from app.core.security import get_current_user, get_current_user_optional
from app.models.report import Report
from app.models.user import User
from app.models.event import Event
from app.models.notification import NotificationType
from app.services.notifications import notification_service
from app.services.resend_email import resend_email_service
from app.api.notifications import create_notification
from app.utils.pii import mask_email

logger = logging.getLogger(__name__)

router = APIRouter()

# --- Schemas ---

class ReportCreate(BaseModel):
    target_type: str
    target_id: str
    reason: str
    details: Optional[str] = None

class ReportResponse(ReportCreate):
    id: int
    status: str
    created_at: datetime

class ModerationAction(BaseModel):
    action: str  # approve, reject, dismiss, resolve

# --- Endpoints ---

@router.post("/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    report_data: ReportCreate,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Submit a report for an event or venue.
    """
    report = Report(
        target_type=report_data.target_type,
        target_id=report_data.target_id,
        reason=report_data.reason,
        details=report_data.details,
        reporter_id=str(current_user.id) if current_user else None
    )
    session.add(report)
    session.commit()
    session.refresh(report)
    return report

@router.get("/queue", response_model=List[ReportResponse])
def get_moderation_queue(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get all pending reports. Admin only.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    reports = session.exec(
        select(Report).where(Report.status == "pending").order_by(Report.created_at.asc())
    ).all()
    return reports

@router.get("/events/pending", response_model=List[Event])
def get_pending_events(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get all pending events requiring approval. Admin only.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    events = session.exec(
        select(Event).where(Event.status == "pending").order_by(Event.created_at.asc())
    ).all()
    return events

@router.post("/reports/{report_id}/resolve")
def resolve_report(
    report_id: int,
    action: str, # dismiss, resolve
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Resolve a report. Admin only.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report.status = "resolved" if action == "resolve" else "dismissed"
    report.resolved_at = datetime.utcnow()
    report.resolved_by = str(current_user.id)
    
    session.add(report)
    session.commit()
    return {"status": "success", "report_status": report.status}

class EventModerationRequest(BaseModel):
    """Schema for event moderation action."""
    action: str  # approve, reject
    rejection_reason: Optional[str] = None


@router.post("/events/{event_id}/moderate")
def moderate_event(
    event_id: str,
    moderation: EventModerationRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Approve or reject a pending event. Admin only.

    For rejection, include a rejection_reason to help the organizer understand
    what needs to be changed.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    action = moderation.action
    if action == "approve":
        event.status = "published"
        # Increment organizer's trust level for successful approval
        if event.organizer:
            event.organizer.trust_level = (event.organizer.trust_level or 0) + 1
            session.add(event.organizer)
        
        # If this event has a recurrence_group_id, approve ALL events in the group
        if event.recurrence_group_id:
            from sqlalchemy import and_
            sibling_events = session.exec(
                select(Event).where(
                    and_(
                        Event.recurrence_group_id == event.recurrence_group_id,
                        Event.id != event.id,
                        Event.status == "pending"
                    )
                )
            ).all()
            for sibling in sibling_events:
                sibling.status = "published"
                session.add(sibling)
            logger.info(f"Approved {len(sibling_events)} sibling events in recurrence group {event.recurrence_group_id}")
    elif action == "reject":
        event.status = "rejected"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    session.add(event)
    session.commit()
    session.refresh(event)

    # Send email notification via Resend
    if event.organizer and event.organizer.email:
        try:
            if action == "approve":
                resend_email_service.send_event_approved(
                    to_email=event.organizer.email,
                    event_title=event.title,
                    event_id=str(event.id),
                    display_name=event.organizer.display_name,
                    is_auto_approved=False
                )
                logger.info(f"Approval email sent to {mask_email(event.organizer.email)} for event {event.id}")
            elif action == "reject":
                resend_email_service.send_event_rejected(
                    to_email=event.organizer.email,
                    event_title=event.title,
                    event_id=str(event.id),
                    rejection_reason=moderation.rejection_reason,
                    display_name=event.organizer.display_name
                )
                logger.info(f"Rejection email sent to {mask_email(event.organizer.email)} for event {event.id}")
        except Exception as e:
            # Log error but don't fail the request - moderation action succeeded
            logger.error(f"Failed to send moderation email for event {event.id}: {e}")

    # Create in-app notification for the organizer
    if event.organizer_id:
        try:
            if action == "approve":
                create_notification(
                    session=session,
                    user_id=event.organizer_id,
                    notification_type=NotificationType.EVENT_APPROVED,
                    title="Event Approved! 🎉",
                    message=f"Your event '{event.title}' has been approved and is now live.",
                    link=f"/events/{event.id}"
                )
                logger.info(f"Approval notification created for user {event.organizer_id}")
                
                # Notify users who follow this event's category/venue/organizer
                notify_interested_users(event, session)
            elif action == "reject":
                reason_text = f" Reason: {moderation.rejection_reason}" if moderation.rejection_reason else ""
                create_notification(
                    session=session,
                    user_id=event.organizer_id,
                    notification_type=NotificationType.EVENT_REJECTED,
                    title="Event Not Approved",
                    message=f"Your event '{event.title}' was not approved.{reason_text}",
                    link=f"/events/{event.id}/edit"
                )
                logger.info(f"Rejection notification created for user {event.organizer_id}")
        except Exception as e:
            logger.error(f"Failed to create in-app notification for event {event.id}: {e}")

    return {"status": "success", "event_status": event.status}


def notify_interested_users(event: Event, session: Session):
    """
    Notify users who follow the event's category, venue, or organizer.
    Creates NEW_EVENT notifications for applicable users.
    """
    from app.models.user_category_follow import UserCategoryFollow
    from app.models.follow import Follow
    from sqlalchemy import or_
    
    try:
        # Build conditions to find interested users
        interested_user_ids = set()
        
        # Find users following this category
        if event.category_id:
            category_followers = session.exec(
                select(UserCategoryFollow.user_id).where(
                    UserCategoryFollow.category_id == event.category_id
                )
            ).all()
            interested_user_ids.update(category_followers)
        
        # Find users following this venue
        if event.venue_id:
            venue_followers = session.exec(
                select(Follow.follower_id).where(
                    Follow.target_id == event.venue_id,
                    Follow.target_type == "venue"
                )
            ).all()
            interested_user_ids.update(venue_followers)
        
        # Find users following this organizer
        if event.organizer_profile_id:
            organizer_followers = session.exec(
                select(Follow.follower_id).where(
                    Follow.target_id == event.organizer_profile_id,
                    Follow.target_type == "group"
                )
            ).all()
            interested_user_ids.update(organizer_followers)
        
        if not interested_user_ids:
            return
        
        # Filter out users who have disabled notifications
        # Also exclude the event organizer (they already know about their event)
        users_to_notify = session.exec(
            select(User).where(
                User.id.in_(interested_user_ids),
                User.receive_interest_notifications == True,
                User.id != event.organizer_id  # Don't notify the organizer
            )
        ).all()
        
        # Determine what they're following (for the notification message)
        interest_name = ""
        if event.category:
            interest_name = event.category.name
        elif event.venue:
            interest_name = event.venue.name
        
        # Create notifications
        for user in users_to_notify:
            try:
                create_notification(
                    session=session,
                    user_id=user.id,
                    notification_type=NotificationType.NEW_EVENT,
                    title="New Event You Might Like 🎉",
                    message=f"New event in {interest_name}: {event.title}",
                    link=f"/events/{event.id}"
                )
            except Exception as e:
                logger.error(f"Failed to create interest notification for user {user.id}: {e}")
        
        logger.info(f"Created {len(users_to_notify)} interest notifications for event {event.id}")
        
    except Exception as e:
        logger.error(f"Error notifying interested users for event {event.id}: {e}")
