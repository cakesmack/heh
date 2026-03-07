"""
Campaign email service for bulk marketing emails via Amazon SES SMTP.
Completely isolated from the transactional SmartEmailService.
"""
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple
from uuid import uuid4

import aiosmtplib
from email.message import EmailMessage
from jinja2 import Environment, FileSystemLoader

from app.core.config import settings
from app.utils.pii import mask_email

logger = logging.getLogger(__name__)

# Jinja2 template setup
TEMPLATE_DIR = Path(__file__).parent.parent / "templates"
jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)), autoescape=False)


def get_unsubscribe_url(token: str) -> str:
    """Generate the public unsubscribe URL for a user."""
    return f"{settings.FRONTEND_URL}/unsubscribe?token={token}"


def render_campaign_html(subject: str, body_html: str, unsubscribe_url: str) -> str:
    """
    Render the campaign email template with Jinja2.

    Args:
        subject: Email subject line (used in <title>).
        body_html: The admin-authored HTML content for the body area.
        unsubscribe_url: Per-user unsubscribe link.
    """
    template = jinja_env.get_template("campaign_template.html")
    return template.render(
        subject=subject,
        body=body_html,
        unsubscribe_url=unsubscribe_url,
    )


async def send_single_campaign_email(
    to: str,
    subject: str,
    html_content: str,
) -> bool:
    """
    Send a single campaign email via Amazon SES SMTP.
    Uses STARTTLS on port 587 (separate from Hostinger's port 465 TLS).
    """
    if not settings.CAMPAIGN_SMTP_USER or not settings.CAMPAIGN_SMTP_PASS:
        logger.info(f"[DRY RUN - CAMPAIGN] Would send to {mask_email(to)}")
        return True

    message = EmailMessage()
    message["From"] = settings.CAMPAIGN_FROM_ADDRESS
    message["To"] = to
    message["Subject"] = subject
    message.set_content(html_content, subtype="html")

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.CAMPAIGN_SMTP_HOST,
            port=settings.CAMPAIGN_SMTP_PORT,
            username=settings.CAMPAIGN_SMTP_USER,
            password=settings.CAMPAIGN_SMTP_PASS,
            start_tls=True,  # STARTTLS for SES (port 587)
        )
        logger.info(f"[CAMPAIGN] Email sent to {mask_email(to)}")
        return True
    except Exception as e:
        logger.error(f"[CAMPAIGN_FAILURE] Failed to send to {mask_email(to)}: {e}")
        return False


async def send_batch_campaign(
    subject: str,
    body_html: str,
    recipients: List[Tuple[str, str, str]],  # [(user_id, email, unsubscribe_token), ...]
    campaign_id: str,
    db_session_factory,
) -> dict:
    """
    Send campaign emails to all recipients with rate limiting and per-user logging.

    Args:
        subject: Email subject line.
        body_html: Admin-authored HTML content.
        recipients: List of (user_id, email, unsubscribe_token) tuples.
        campaign_id: Shared UUID for this batch run.
        db_session_factory: Callable that returns a new DB session.

    Returns:
        dict with sent/failed/total counts.
    """
    from app.models.campaign_log import CampaignLog

    sent_count = 0
    failed_count = 0
    total = len(recipients)

    logger.info(f"[CAMPAIGN:{campaign_id}] Starting batch send: {total} recipients")

    for i, (user_id, email, unsub_token) in enumerate(recipients):
        # Generate per-user unsubscribe URL
        unsubscribe_url = get_unsubscribe_url(unsub_token)

        # Render personalised HTML
        html = render_campaign_html(subject, body_html, unsubscribe_url)
        # Attempt send
        success = await send_single_campaign_email(email, subject, html)

        # Log result to database
        log_entry = CampaignLog(
            campaign_id=campaign_id,
            subject=subject,
            user_id=user_id,
            email=email,
            status="sent" if success else "failed",
            error_message=None if success else "SMTP send failed — check server logs",
            sent_at=datetime.utcnow() if success else None,
        )

        # Use a fresh session for each log to avoid long-lived transactions
        with db_session_factory() as session:
            session.add(log_entry)
            session.commit()

        if success:
            sent_count += 1
        else:
            failed_count += 1

        # Progress logging every 10 emails
        if (i + 1) % 10 == 0:
            logger.info(f"[CAMPAIGN:{campaign_id}] Progress: {i + 1}/{total} (sent={sent_count}, failed={failed_count})")

        # Rate limiting: 1.1 seconds between sends (SES Sandbox = 1 email/sec)
        if i < total - 1:
            await asyncio.sleep(1.1)

    logger.info(
        f"[CAMPAIGN:{campaign_id}] Batch complete: {sent_count} sent, {failed_count} failed, {total} total"
    )

    return {"sent": sent_count, "failed": failed_count, "total": total, "campaign_id": campaign_id}
