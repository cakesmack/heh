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
from app.services.notifications import notification_service
from app.services.resend_email import resend_email_service

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
                logger.info(f"Approval email sent to {event.organizer.email} for event {event.id}")
            elif action == "reject":
                resend_email_service.send_event_rejected(
                    to_email=event.organizer.email,
                    event_title=event.title,
                    event_id=str(event.id),
                    rejection_reason=moderation.rejection_reason,
                    display_name=event.organizer.display_name
                )
                logger.info(f"Rejection email sent to {event.organizer.email} for event {event.id}")
        except Exception as e:
            # Log error but don't fail the request - moderation action succeeded
            logger.error(f"Failed to send moderation email for event {event.id}: {e}")

    return {"status": "success", "event_status": event.status}
