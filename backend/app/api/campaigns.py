"""
Campaign API routes for admin-only bulk email sending.
Provides endpoints for sending test emails, batch campaigns,
and querying subscriber counts.
"""
import logging
from uuid import uuid4
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlmodel import Session, select, func

from app.core.database import get_session, engine
from app.core.security import get_current_user
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.models.campaign_log import CampaignLog
from app.services.campaign_service import (
    render_campaign_html,
    send_single_campaign_email,
    send_batch_campaign,
    get_unsubscribe_url,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Campaigns"])


# --- Schemas ---

class CampaignRequest(BaseModel):
    """Request body for sending a campaign."""
    subject: str = Field(..., min_length=1, max_length=500)
    body: str = Field(..., min_length=1, max_length=50000, description="HTML content for the email body")


class CampaignStatusResponse(BaseModel):
    """Response after initiating a campaign."""
    message: str
    campaign_id: str
    recipient_count: int


class SubscriberCountResponse(BaseModel):
    """Response with subscriber count."""
    subscriber_count: int


class CampaignLogResponse(BaseModel):
    """Response for campaign log entries."""
    campaign_id: str
    subject: str
    user_id: str
    email: str
    status: str
    error_message: Optional[str] = None
    sent_at: Optional[str] = None


# --- Helper: Admin check ---

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures the user is an admin."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# --- Endpoints ---

@router.get("/subscribers", response_model=SubscriberCountResponse)
def get_subscriber_count(
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Get the count of users subscribed to email updates."""
    count = session.exec(
        select(func.count()).where(UserPreferences.receives_email_updates == True)
    ).one() or 0

    return SubscriberCountResponse(subscriber_count=count)


@router.post("/test", response_model=dict)
async def send_test_campaign(
    campaign: CampaignRequest,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """
    Send a test campaign email to the logged-in admin's own email.
    This is synchronous (waits for the send to complete).
    """
    # Get admin's unsubscribe token (or generate a dummy one for test)
    prefs = session.exec(
        select(UserPreferences).where(UserPreferences.user_id == admin.id)
    ).first()

    unsub_token = prefs.unsubscribe_token if prefs else "test-token"
    unsubscribe_url = get_unsubscribe_url(unsub_token)

    # Render and send
    html = render_campaign_html(campaign.subject, campaign.body, unsubscribe_url)
    success = await send_single_campaign_email(admin.email, campaign.subject, html)

    if success:
        return {"message": f"Test email sent to {admin.email}", "success": True}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send test email. Check server logs."
        )


@router.post("/send", response_model=CampaignStatusResponse)
async def send_campaign(
    campaign: CampaignRequest,
    background_tasks: BackgroundTasks,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """
    Send a campaign email to all subscribed users.
    Runs as a BackgroundTask so the admin's browser doesn't time out.
    """
    # Fetch all subscribed users with their unsubscribe tokens
    results = session.exec(
        select(UserPreferences.user_id, User.email, UserPreferences.unsubscribe_token)
        .join(User, User.id == UserPreferences.user_id)
        .where(UserPreferences.receives_email_updates == True)
        .where(User.is_active == True)
    ).all()

    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No subscribed users found"
        )

    # Convert to list of tuples
    recipients = [(r[0], r[1], r[2]) for r in results]
    campaign_id = str(uuid4()).replace("-", "")[:12]

    logger.info(
        f"[CAMPAIGN:{campaign_id}] Admin {admin.email} initiated campaign "
        f"'{campaign.subject}' to {len(recipients)} recipients"
    )

    # Create a session factory for the background task (it needs its own sessions)
    from sqlmodel import Session as SMSession

    def db_session_factory():
        return SMSession(engine)

    # Fire and forget — the batch runs in the background
    background_tasks.add_task(
        send_batch_campaign,
        subject=campaign.subject,
        body_html=campaign.body,
        recipients=recipients,
        campaign_id=campaign_id,
        db_session_factory=db_session_factory,
    )

    return CampaignStatusResponse(
        message="Campaign is being sent in the background. Check logs for progress.",
        campaign_id=campaign_id,
        recipient_count=len(recipients),
    )


@router.get("/logs/{campaign_id}")
def get_campaign_logs(
    campaign_id: str,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Get the send logs for a specific campaign batch."""
    logs = session.exec(
        select(CampaignLog)
        .where(CampaignLog.campaign_id == campaign_id)
        .order_by(CampaignLog.created_at.asc())
    ).all()

    sent = sum(1 for l in logs if l.status == "sent")
    failed = sum(1 for l in logs if l.status == "failed")

    return {
        "campaign_id": campaign_id,
        "total": len(logs),
        "sent": sent,
        "failed": failed,
        "logs": [
            {
                "user_id": l.user_id,
                "email": l.email,
                "status": l.status,
                "error_message": l.error_message,
                "sent_at": str(l.sent_at) if l.sent_at else None,
            }
            for l in logs
        ],
    }
