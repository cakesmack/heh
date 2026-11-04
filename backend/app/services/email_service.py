"""Shared transactional email delivery via Amazon SES or Hostinger SMTP."""

import logging
import re
from email.message import EmailMessage

import aiosmtplib

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
    async def send_smart_email(
        self,
        email_type: str,
        to: str,
        subject: str,
        html_content: str,
        text_content: str | None = None,
    ) -> bool:
        required_settings = (
            "TRANSACTIONAL_SMTP_HOST",
            "TRANSACTIONAL_SMTP_PORT",
            "TRANSACTIONAL_SMTP_USER",
            "TRANSACTIONAL_SMTP_PASS",
            "TRANSACTIONAL_FROM_ADDRESS",
        )
        missing = [
            name for name in required_settings
            if not str(getattr(settings, name) or "").strip()
        ]
        use_ses = not missing
        configuration_set = None
        if use_ses:
            provider = "Amazon SES"
            sender = settings.TRANSACTIONAL_FROM_ADDRESS
            configuration_set = settings.TRANSACTIONAL_SES_CONFIGURATION_SET
            smtp_options = dict(
                hostname=settings.TRANSACTIONAL_SMTP_HOST,
                port=settings.TRANSACTIONAL_SMTP_PORT,
                username=settings.TRANSACTIONAL_SMTP_USER,
                password=settings.TRANSACTIONAL_SMTP_PASS,
                start_tls=settings.TRANSACTIONAL_SMTP_STARTTLS,
                use_tls=not settings.TRANSACTIONAL_SMTP_STARTTLS,
            )
        elif (
            email_type != EmailType.SECURITY
            and settings.HOSTINGER_SMTP_USER
            and settings.HOSTINGER_SMTP_PASS
            and settings.EMAIL_FROM_ADDRESS
        ):
            logger.warning("Transactional SES settings missing (%s); using Hostinger SMTP for %s",
                           ", ".join(missing), email_type)
            provider = "Hostinger SMTP"
            sender = settings.EMAIL_FROM_ADDRESS
            smtp_options = dict(
                hostname=settings.HOSTINGER_SMTP_HOST,
                port=settings.HOSTINGER_SMTP_PORT,
                username=settings.HOSTINGER_SMTP_USER,
                password=settings.HOSTINGER_SMTP_PASS,
                use_tls=True,
            )
        else:
            logger.error("Cannot send %s: missing transactional SES settings (%s)",
                         email_type, ", ".join(missing))
            return False

        recipient = mask_email(to)
        try:
            message = EmailMessage()
            message["From"] = sender
            message["To"] = to
            message["Subject"] = subject
            if configuration_set:
                message["X-SES-CONFIGURATION-SET"] = configuration_set
            if text_content:
                message.set_content(text_content)
                message.add_alternative(html_content, subtype="html")
            else:
                message.set_content(html_content, subtype="html")

            _, response = await aiosmtplib.send(message, **smtp_options)
        except Exception as exc:
            code = getattr(exc, "code", None)
            logger.error("%s failed for %s email to %s (%s, SMTP code %s)",
                         provider, email_type, recipient, type(exc).__name__,
                         code if isinstance(code, int) else "unavailable")
            return False

        message_id = re.fullmatch(r"Ok ([A-Za-z0-9-]+)", response) if use_ses else None
        logger.info("%s accepted %s email to %s (message ID %s)",
                    provider, email_type, recipient,
                    message_id.group(1) if message_id else "unavailable")
        return True


smart_email_service = SmartEmailService()
