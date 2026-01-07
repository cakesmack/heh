"""
Resend email service for marketing and transactional emails.
Uses Resend API for reliable email delivery with tracking.
"""
import logging
from typing import Optional
import resend

from app.core.config import settings
from app.utils.pii import mask_email

logger = logging.getLogger(__name__)


class ResendEmailService:
    """Email service using Resend API."""

    def __init__(self):
        if settings.RESEND_API_KEY:
            resend.api_key = settings.RESEND_API_KEY
            self.enabled = True
            # Production email from verified domain
            self.from_address = "Highland Events Hub <noreply@highlandeventshub.co.uk>"
        else:
            self.enabled = False
            logger.warning("RESEND_API_KEY not configured - emails disabled")

    def send_welcome(self, to_email: str, display_name: Optional[str] = None) -> bool:
        """
        Send welcome email to new user.

        Args:
            to_email: User's email address
            display_name: User's display name (optional)

        Returns:
            True if sent successfully
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send welcome email to {mask_email(to_email)}")
            return True

        name = display_name or "there"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 0 auto; }}
                .header {{ background: linear-gradient(135deg, #10b981, #059669); padding: 40px 30px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 28px; }}
                .header p {{ color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; }}
                .content {{ padding: 40px 30px; background: #ffffff; }}
                .content h2 {{ color: #059669; margin-top: 0; }}
                .feature {{ display: flex; align-items: flex-start; margin: 20px 0; }}
                .feature-icon {{ width: 40px; height: 40px; background: #d1fae5; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0; }}
                .button {{ display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
                .footer {{ background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to the Hub!</h1>
                    <p>Your guide to events in the Scottish Highlands</p>
                </div>
                <div class="content">
                    <h2>Hey {name}!</h2>
                    <p>You're now part of a community that celebrates everything happening across the Highlands - from ceilidhs in village halls to festivals on the shores of Loch Ness.</p>

                    <p><strong>Here's what you can do:</strong></p>

                    <div class="feature">
                        <div class="feature-icon">&#x1F4CD;</div>
                        <div>
                            <strong>Discover Local Events</strong><br>
                            Find gigs, markets, sports, and community gatherings near you.
                        </div>
                    </div>

                    <div class="feature">
                        <div class="feature-icon">&#x1F39F;</div>
                        <div>
                            <strong>Save Your Favourites</strong><br>
                            Bookmark events so you never miss out.
                        </div>
                    </div>

                    <div class="feature">
                        <div class="feature-icon">&#x1F4E3;</div>
                        <div>
                            <strong>Promote Your Own Events</strong><br>
                            Running something? List it for free and reach the whole Highlands.
                        </div>
                    </div>

                    <p style="text-align: center;">
                        <a href="{settings.FRONTEND_URL}" class="button">Explore Events</a>
                    </p>
                </div>
                <div class="footer">
                    <p>Highland Events Hub<br>Discover what's on across the Scottish Highlands</p>
                </div>
            </div>
        </body>
        </html>
        """

        try:
            response = resend.Emails.send({
                "from": self.from_address,
                "to": [to_email],
                "subject": "Welcome to the Hub!",
                "html": html_content,
            })
            logger.info(f"Welcome email sent to {mask_email(to_email)}, id: {response.get('id')}")
            return True
        except Exception as e:
            logger.error(f"Failed to send welcome email to {mask_email(to_email)}: {e}")
            return False

    def send_weekly_digest(
        self,
        to_email: str,
        display_name: Optional[str],
        events: list,
        unsubscribe_token: str
    ) -> bool:
        """
        Send weekly digest email with personalized event recommendations.

        Args:
            to_email: User's email
            display_name: User's name
            events: List of recommended events
            unsubscribe_token: Token for one-click unsubscribe

        Returns:
            True if sent successfully
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send weekly digest to {mask_email(to_email)}")
            return True

        name = display_name or "there"
        unsubscribe_url = f"{settings.FRONTEND_URL}/unsubscribe?token={unsubscribe_token}&type=weekly_digest"

        # Build event list HTML
        events_html = ""
        for event in events[:5]:  # Max 5 events
            events_html += f"""
            <div style="border-left: 4px solid #10b981; padding-left: 15px; margin: 20px 0;">
                <strong style="color: #1f2937;">{event.get('title', 'Event')}</strong><br>
                <span style="color: #6b7280; font-size: 14px;">
                    {event.get('date_display', '')} • {event.get('location', '')}
                </span>
            </div>
            """

        if not events_html:
            events_html = "<p>Check the Hub for the latest events in your area!</p>"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 0 auto; }}
                .header {{ background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ padding: 30px; background: #ffffff; }}
                .button {{ display: inline-block; background: #10b981; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; }}
                .footer {{ background: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }}
                .footer a {{ color: #6b7280; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Your Weekend in the Highlands</h1>
                </div>
                <div class="content">
                    <p>Hey {name}! Here's what's happening this weekend:</p>

                    {events_html}

                    <p style="text-align: center; margin-top: 30px;">
                        <a href="{settings.FRONTEND_URL}" class="button">See All Events</a>
                    </p>
                </div>
                <div class="footer">
                    <p>You're receiving this because you signed up for the weekly digest.</p>
                    <p><a href="{unsubscribe_url}">Unsubscribe from weekly digest</a></p>
                </div>
            </div>
        </body>
        </html>
        """

        try:
            response = resend.Emails.send({
                "from": self.from_address,
                "to": [to_email],
                "subject": "Your Weekend in the Highlands",
                "html": html_content,
            })
            logger.info(f"Weekly digest sent to {mask_email(to_email)}, id: {response.get('id')}")
            return True
        except Exception as e:
            logger.error(f"Failed to send weekly digest to {mask_email(to_email)}: {e}")
            return False

    def send_organizer_alert(
        self,
        to_email: str,
        display_name: Optional[str],
        event_title: str,
        alert_type: str,
        unsubscribe_token: str
    ) -> bool:
        """
        Send organizer alert (event approved, etc).

        Args:
            to_email: Organizer's email
            display_name: Organizer's name
            event_title: Name of the event
            alert_type: Type of alert (approved, rejected, etc)
            unsubscribe_token: Token for unsubscribe

        Returns:
            True if sent successfully
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send organizer alert to {mask_email(to_email)}")
            return True

        name = display_name or "there"
        unsubscribe_url = f"{settings.FRONTEND_URL}/unsubscribe?token={unsubscribe_token}&type=organizer_alerts"

        if alert_type == "approved":
            subject = f"Your event is live: {event_title}"
            message = f"Great news! <strong>{event_title}</strong> has been approved and is now live on the Hub."
            cta_text = "View Your Event"
        else:
            subject = f"Update on your event: {event_title}"
            message = f"There's an update on <strong>{event_title}</strong>."
            cta_text = "View Details"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; }}
                .container {{ max-width: 600px; margin: 0 auto; }}
                .header {{ background: #10b981; padding: 25px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 20px; }}
                .content {{ padding: 30px; background: #ffffff; }}
                .button {{ display: inline-block; background: #10b981; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; }}
                .footer {{ background: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }}
                .footer a {{ color: #6b7280; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Highland Events</h1>
                </div>
                <div class="content">
                    <p>Hey {name}!</p>
                    <p>{message}</p>
                    <p style="text-align: center; margin-top: 25px;">
                        <a href="{settings.FRONTEND_URL}/account" class="button">{cta_text}</a>
                    </p>
                </div>
                <div class="footer">
                    <p><a href="{unsubscribe_url}">Unsubscribe from organizer alerts</a></p>
                </div>
            </div>
        </body>
        </html>
        """

        try:
            response = resend.Emails.send({
                "from": self.from_address,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            })
            logger.info(f"Organizer alert sent to {mask_email(to_email)}, id: {response.get('id')}")
            return True
        except Exception as e:
            logger.error(f"Failed to send organizer alert to {mask_email(to_email)}: {e}")
            return False


    def send_event_approved(
        self,
        to_email: str,
        event_title: str,
        event_id: str,
        display_name: Optional[str] = None,
        is_auto_approved: bool = False
    ) -> bool:
        """
        Send notification when an event is approved.

        Args:
            to_email: Organizer's email
            event_title: Name of the event
            event_id: Event ID for linking
            display_name: Organizer's name (optional)
            is_auto_approved: Whether this was auto-approved based on trust

        Returns:
            True if sent successfully
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send event approved email to {mask_email(to_email)}")
            return True

        name = display_name or "there"
        event_url = f"{settings.FRONTEND_URL}/events/{event_id}"

        if is_auto_approved:
            subject = "Your event is live!"
            subtitle = "Auto-approved based on your trust score"
            message = f"Great news! Your event <strong>'{event_title}'</strong> has been automatically approved and is now live on the Highland Events Hub."
        else:
            subject = "Your event is live!"
            subtitle = "Your event has been approved"
            message = f"Great news! Your event <strong>'{event_title}'</strong> has been approved by our moderation team and is now published on the Highland Events Hub."

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 0 auto; }}
                .header {{ background: linear-gradient(135deg, #10b981, #059669); padding: 40px 30px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 28px; }}
                .header p {{ color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; }}
                .content {{ padding: 40px 30px; background: #ffffff; }}
                .success-icon {{ width: 60px; height: 60px; background: #d1fae5; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 30px; }}
                .button {{ display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
                .footer {{ background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{subject}</h1>
                    <p>{subtitle}</p>
                </div>
                <div class="content">
                    <div class="success-icon">&#x2705;</div>
                    <p>Hey {name}!</p>
                    <p>{message}</p>
                    <p>People can now discover your event on the Hub. Share it with your community to boost attendance!</p>
                    <p style="text-align: center;">
                        <a href="{event_url}" class="button">View Your Event</a>
                    </p>
                </div>
                <div class="footer">
                    <p>Highland Events Hub<br>Discover what's on across the Scottish Highlands</p>
                </div>
            </div>
        </body>
        </html>
        """

        try:
            response = resend.Emails.send({
                "from": self.from_address,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            })
            logger.info(f"Event approved email sent to {mask_email(to_email)} for event {event_id}, id: {response.get('id')}")
            return True
        except Exception as e:
            logger.error(f"Failed to send event approved email to {mask_email(to_email)}: {e}")
            return False

    def send_event_rejected(
        self,
        to_email: str,
        event_title: str,
        event_id: str,
        rejection_reason: Optional[str] = None,
        display_name: Optional[str] = None
    ) -> bool:
        """
        Send notification when an event is rejected.

        Args:
            to_email: Organizer's email
            event_title: Name of the event
            event_id: Event ID for editing
            rejection_reason: Reason for rejection (optional)
            display_name: Organizer's name (optional)

        Returns:
            True if sent successfully
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send event rejected email to {mask_email(to_email)}")
            return True

        name = display_name or "there"
        edit_url = f"{settings.FRONTEND_URL}/events/{event_id}/edit"

        reason_html = ""
        if rejection_reason:
            reason_html = f"""
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <strong style="color: #92400e;">Reason:</strong>
                <p style="color: #92400e; margin: 5px 0 0 0;">{rejection_reason}</p>
            </div>
            """

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 0 auto; }}
                .header {{ background: linear-gradient(135deg, #f59e0b, #d97706); padding: 40px 30px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .header p {{ color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; }}
                .content {{ padding: 40px 30px; background: #ffffff; }}
                .button {{ display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
                .button-secondary {{ display: inline-block; background: #6b7280; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 10px; }}
                .footer {{ background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Update regarding your event</h1>
                    <p>Action required</p>
                </div>
                <div class="content">
                    <p>Hey {name},</p>
                    <p>Unfortunately, your event <strong>'{event_title}'</strong> was not approved for publication on the Highland Events Hub.</p>
                    {reason_html}
                    <p>Don't worry - you can edit your event and resubmit it for review. Please address the feedback above and try again.</p>
                    <p style="text-align: center;">
                        <a href="{edit_url}" class="button">Edit & Resubmit</a>
                    </p>
                    <p style="text-align: center; color: #6b7280; font-size: 14px;">
                        Need help? Reply to this email and we'll assist you.
                    </p>
                </div>
                <div class="footer">
                    <p>Highland Events Hub<br>Discover what's on across the Scottish Highlands</p>
                </div>
            </div>
        </body>
        </html>
        """

        try:
            response = resend.Emails.send({
                "from": self.from_address,
                "to": [to_email],
                "subject": f"Update regarding your event: {event_title}",
                "html": html_content,
            })
            logger.info(f"Event rejected email sent to {mask_email(to_email)} for event {event_id}, id: {response.get('id')}")
            return True
        except Exception as e:
            logger.error(f"Failed to send event rejected email to {mask_email(to_email)}: {e}")
            return False

    def send_welcome_with_events(
        self,
        to_email: str,
        display_name: Optional[str] = None,
        events: list = None
    ) -> bool:
        """
        Send welcome email with featured events.

        Args:
            to_email: User's email address
            display_name: User's display name (optional)
            events: List of event dicts with title, date_display, venue_name, id

        Returns:
            True if sent successfully
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send welcome email with events to {mask_email(to_email)}")
            return True

        name = display_name or "there"
        events = events or []

        # Build event cards HTML
        events_html = ""
        for event in events[:6]:
            event_url = f"{settings.FRONTEND_URL}/events/{event.get('id', '')}"
            events_html += f"""
            <div style="border-left: 4px solid #10b981; padding: 12px 15px; margin: 12px 0; background: #f9fafb; border-radius: 0 8px 8px 0;">
                <a href="{event_url}" style="color: #059669; font-weight: 600; text-decoration: none; font-size: 15px;">{event.get('title', 'Event')}</a><br>
                <span style="color: #6b7280; font-size: 13px;">
                    📅 {event.get('date_display', '')} &nbsp;•&nbsp; 📍 {event.get('venue_name', 'Various Locations')}
                </span>
            </div>
            """

        if not events_html:
            events_html = "<p style='color: #6b7280;'>Check the Hub for the latest events!</p>"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 0 auto; }}
                .header {{ background: linear-gradient(135deg, #10b981, #059669); padding: 40px 30px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 28px; }}
                .header p {{ color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; }}
                .content {{ padding: 40px 30px; background: #ffffff; }}
                .content h2 {{ color: #059669; margin-top: 0; }}
                .button {{ display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
                .footer {{ background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to the Hub!</h1>
                    <p>Your guide to events in the Scottish Highlands</p>
                </div>
                <div class="content">
                    <h2>Hey {name}!</h2>
                    <p>You're now part of a community that celebrates everything happening across the Highlands - from ceilidhs in village halls to festivals on the shores of Loch Ness.</p>
                    
                    <h3 style="color: #374151; margin-top: 30px;">🎉 Happening Soon</h3>
                    {events_html}
                    
                    <p style="text-align: center; margin-top: 30px;">
                        <a href="{settings.FRONTEND_URL}" class="button">Explore All Events</a>
                    </p>
                </div>
                <div class="footer">
                    <p>Highland Events Hub<br>Discover what's on across the Scottish Highlands</p>
                </div>
            </div>
        </body>
        </html>
        """

        try:
            response = resend.Emails.send({
                "from": self.from_address,
                "to": [to_email],
                "subject": "Welcome to the Hub! 🎉",
                "html": html_content,
            })
            logger.info(f"Welcome email with events sent to {mask_email(to_email)}, id: {response.get('id')}")
            return True
        except Exception as e:
            logger.error(f"Failed to send welcome email with events to {mask_email(to_email)}: {e}")
            return False

    def send_system_alert(
        self,
        to_email: str,
        subject: str,
        message_body: str
    ) -> bool:
        """
        Send a system alert email (styled like event approval).

        Args:
            to_email: Recipient email
            subject: Email subject line
            message_body: HTML message body

        Returns:
            True if sent successfully
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send system alert to {mask_email(to_email)}")
            return True

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 0 auto; }}
                .header {{ background: linear-gradient(135deg, #10b981, #059669); padding: 40px 30px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ padding: 40px 30px; background: #ffffff; }}
                .alert-icon {{ width: 60px; height: 60px; background: #fef3c7; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 30px; }}
                .button {{ display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
                .footer {{ background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{subject}</h1>
                </div>
                <div class="content">
                    <div class="alert-icon">📢</div>
                    <div style="font-size: 16px;">
                        {message_body}
                    </div>
                    <p style="text-align: center; margin-top: 30px;">
                        <a href="{settings.FRONTEND_URL}" class="button">Visit Highland Events Hub</a>
                    </p>
                </div>
                <div class="footer">
                    <p>Highland Events Hub<br>Discover what's on across the Scottish Highlands</p>
                </div>
            </div>
        </body>
        </html>
        """

        try:
            response = resend.Emails.send({
                "from": self.from_address,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            })
            logger.info(f"System alert sent to {mask_email(to_email)}, id: {response.get('id')}")
            return True
        except Exception as e:
            logger.error(f"Failed to send system alert to {mask_email(to_email)}: {e}")
            return False


# Global instance
resend_email_service = ResendEmailService()
