"""
Smart email service abstraction for routing between Resend (SECURITY) and Hostinger SMTP (WELCOME, MODERATION, INVITE).
"""
import logging
from typing import Optional, List, Dict, Any
import resend
import aiosmtplib
from email.message import EmailMessage
from app.core.config import settings
from app.utils.pii import mask_email

logger = logging.getLogger(__name__)

class EmailType:
    SECURITY = "SECURITY"
    WELCOME = "WELCOME"
    MODERATION = "MODERATION"
    INVITE = "INVITE"
    TICKETING = "TICKETING"

class SmartEmailService:
    """Consolidated email service with provider routing."""

    def __init__(self):
        # Configure Resend
        if settings.RESEND_API_KEY:
            resend.api_key = settings.RESEND_API_KEY
            self.resend_enabled = True
        else:
            self.resend_enabled = False
            logger.warning("RESEND_API_KEY not configured - Resend disabled")

        # Configure SMTP
        self.smtp_host = settings.HOSTINGER_SMTP_HOST
        self.smtp_port = settings.HOSTINGER_SMTP_PORT
        self.smtp_user = settings.HOSTINGER_SMTP_USER
        self.smtp_pass = settings.HOSTINGER_SMTP_PASS
        self.smtp_enabled = bool(self.smtp_user and self.smtp_pass)

        if not self.smtp_enabled:
            logger.warning("HOSTINGER_SMTP_USER/PASS not configured - SMTP disabled")

        self.from_address = settings.EMAIL_FROM_ADDRESS

    async def send_smart_email(
        self, 
        email_type: str, 
        to: str, 
        subject: str, 
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """
        Send email using the appropriate provider based on type.
        """
        if email_type == EmailType.SECURITY:
            return await self._send_via_resend(to, subject, html_content)
        elif self.smtp_enabled:
            return await self._send_via_smtp(to, subject, html_content, text_content)
        elif self.resend_enabled:
            return await self._send_via_resend(to, subject, html_content)
        else:
            logger.info(f"[DRY RUN] Would send {email_type} email to {mask_email(to)}")
            return True

    async def _send_via_resend(self, to: str, subject: str, html_content: str) -> bool:
        """Internal method for Resend delivery."""
        if not self.resend_enabled:
            logger.info(f"[DRY RUN - RESEND] Would send SECURITY email to {mask_email(to)}")
            return True

        try:
            # Note: resend-python is currently synchronous, wrapping it or using it as is
            # if they have an async client in future, we'd use that.
            resend.Emails.send({
                "from": self.from_address,
                "to": [to],
                "subject": subject,
                "html": html_content,
            })
            logger.info(f"SECURITY email sent via Resend to {mask_email(to)}")
            return True
        except Exception as e:
            logger.error(f"Failed to send SECURITY email to {mask_email(to)} via Resend: {e}")
            return False

    async def _send_via_smtp(
        self, 
        to: str, 
        subject: str, 
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Internal method for Hostinger SMTP delivery."""
        if not self.smtp_enabled:
            logger.info(f"[DRY RUN - SMTP] Would send email to {mask_email(to)}")
            return True

        message = EmailMessage()
        message["From"] = self.from_address
        message["To"] = to
        message["Subject"] = subject

        if text_content:
            message.set_content(text_content)
            message.add_alternative(html_content, subtype="html")
        else:
            message.set_content(html_content, subtype="html")

        try:
            await aiosmtplib.send(
                message,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_user,
                password=self.smtp_pass,
                use_tls=True,
            )
            logger.info(f"Email sent via SMTP to {mask_email(to)}")
            return True
        except Exception as e:
            # [SMTP_FAILURE] Logging as requested
            logger.error(f"[SMTP_FAILURE] Failed to send email to {mask_email(to)}: {e}")
            # Do NOT fallback to Resend as per requirement
            return False

# Global instance
smart_email_service = SmartEmailService()
