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
                    <h1>Welcome to Highland Events Hub!</h1>
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
                "subject": "Welcome to Highland Events Hub!",
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
        featured_events: list,
        personalized_events: list,
        unsubscribe_token: str
    ) -> bool:
        """
        Send modern weekly digest with featured and personalized sections.

        Args:
            to_email: User's email
            display_name: User's name (capitalized)
            featured_events: 3 featured/top pick events
            personalized_events: User's personalized matches
            unsubscribe_token: Token for one-click unsubscribe
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send weekly digest to {mask_email(to_email)}")
            return True

        name = display_name or "there"
        # Ensure URLs have no trailing slashes consistency
        site_url = settings.FRONTEND_URL.rstrip('/')
        
        # FIX: Force www. for production domain to prevent link/image issues
        if "highlandeventshub.co.uk" in site_url and "www." not in site_url:
            site_url = site_url.replace("highlandeventshub.co.uk", "www.highlandeventshub.co.uk")
            
        logo_url = f"{site_url}/icons/logo_knot.jpg"
        unsubscribe_url = f"{site_url}/unsubscribe?token={unsubscribe_token}&type=weekly_digest"

        # BRAND COLORS
        # Highland Green: #0F3E35
        # Warm White: #FAF9F6
        # Stone Dark: #2F2F2F
        # Badge Warning: #FEF9C3 (bg), #854D0E (text)

        # Build featured events HTML (Site-like Event Cards)
        featured_html = ""
        for event in featured_events[:3]:
            # IDs are already formatted as UUID strings
            event_id = event.get('id', '')
            event_url = f"{site_url}/events/{event_id}"
            image_url = event.get('image_url')
            
            image_html = ""
            if image_url:
                image_html = f'<img src="{image_url}" alt="" style="width: 100%; height: 180px; object-fit: cover; display: block;">'
            else:
                image_html = '<div style="height: 180px; background: linear-gradient(135deg, #0F3E35, #3F7F66);"></div>'
            
            featured_html += f"""
            <div style="margin-bottom: 24px; border-radius: 12px; overflow: hidden; border: 1px solid #e5e5e5; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                <a href="{event_url}" style="text-decoration: none; display: block; position: relative;">
                    {image_html}
                    <!-- Featured Badge -->
                    <div style="position: absolute; top: 10px; left: 10px; background: #FEF9C3; color: #854D0E; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 999px;">
                        ⭐ Featured
                    </div>
                </a>
                <div style="padding: 16px;">
                    <a href="{event_url}" style="display: block; color: #2F2F2F; font-weight: 600; text-decoration: none; font-size: 18px; margin-bottom: 6px; line-height: 1.4;">{event.get('title', 'Event')}</a>
                    <div style="color: #52525b; font-size: 14px; display: flex; align-items: center; margin-bottom: 4px;">
                        📅 {event.get('date_display', '')}
                    </div>
                    <div style="color: #52525b; font-size: 14px;">
                        📍 {event.get('venue_name', '')}
                    </div>
                </div>
            </div>
            """

        # Build personalized events HTML (Compact List)
        personalized_html = ""
        if personalized_events:
            for event in personalized_events[:6]:
                event_id = event.get('id', '')
                event_url = f"{site_url}/events/{event_id}"
                image_url = event.get('image_url')
                
                image_html = ""
                if image_url:
                    image_html = f'<img src="{image_url}" alt="" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">'
                else:
                    image_html = '<div style="width: 80px; height: 80px; background: #f4f4f5; border-radius: 8px;"></div>'
                
                personalized_html += f"""
                <a href="{event_url}" style="display: flex; align-items: start; text-decoration: none; padding: 12px 0; border-bottom: 1px solid #f4f4f5;">
                    {image_html}
                    <div style="margin-left: 16px; flex: 1;">
                        <div style="color: #2F2F2F; font-weight: 600; font-size: 15px; margin-bottom: 4px; line-height: 1.4;">{event.get('title', 'Event')}</div>
                        <div style="color: #71717a; font-size: 13px;">📅 {event.get('date_display', '')}</div>
                        <div style="color: #71717a; font-size: 13px;">📍 {event.get('venue_name', '')}</div>
                    </div>
                </a>
                """
        else:
            personalized_html = f"""
            <div style="text-align: center; padding: 30px 20px; background: #fafafa; border-radius: 12px;">
                <p style="color: #71717a; margin-bottom: 20px;">Follow venues and categories to get personalized recommendations!</p>
                <a href="{site_url}" style="display: inline-block; background: #0F3E35; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Browse All Events</a>
            </div>
            """

        # Construct HTML string (New Brand Design)
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2F2F2F; margin: 0; padding: 0; background: #FAF9F6;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
                <!-- Brand Top Border -->
                <div style="height: 4px; background: #0F3E35;"></div>
                
                <!-- Header -->
                <div style="padding: 24px; text-align: center; border-bottom: 1px solid #f4f4f5;">
                    <img src="__LOGO_URL__" alt="Highland Events Hub" style="width: 48px; height: 48px;">
                    <h1 style="color: #0F3E35; margin: 12px 0 0 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Highland Events Hub</h1>
                </div>
                
                <!-- Main Content -->
                <div style="padding: 32px 24px;">
                    <p style="font-size: 16px; margin-bottom: 32px; color: #2F2F2F;">Hi __NAME__, check out what's happening this week across the Highlands.</p>
                    
                    <!-- Featured Section -->
                    <div style="margin-bottom: 40px;">
                        <h2 style="color: #0F3E35; font-size: 18px; margin: 0 0 16px 0; font-weight: 700;">Top Picks</h2>
                        __FEATURED_HTML__
                    </div>
                    
                    <!-- Personalized Feed -->
                    <div>
                        <h2 style="color: #0F3E35; font-size: 18px; margin: 0 0 16px 0; font-weight: 700;">For You</h2>
                        __PERSONALIZED_HTML__
                    </div>
                    
                    <!-- CTA -->
                    <div style="text-align: center; margin-top: 40px;">
                        <a href="__SITE_URL__" style="display: inline-block; background: #0F3E35; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View All Events</a>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="background: #2F2F2F; padding: 32px 24px; text-align: center; color: #a1a1aa;">
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #ffffff;">Highland Events Hub</p>
                    <p style="font-size: 12px; margin-bottom: 24px;">Discover what's on across the Scottish Highlands</p>
                    <div style="font-size: 12px;">
                        <a href="__SITE_URL__/account/dashboard" style="color: #a1a1aa; text-decoration: underline; margin: 0 8px;">My Dashboard</a>
                        <a href="__UNSUBSCRIBE_URL__" style="color: #a1a1aa; text-decoration: underline; margin: 0 8px;">Unsubscribe</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        # Perform string replacements
        html_content = html_content.replace("__LOGO_URL__", logo_url)
        html_content = html_content.replace("__NAME__", name)
        html_content = html_content.replace("__FEATURED_HTML__", featured_html)
        html_content = html_content.replace("__PERSONALIZED_HTML__", personalized_html)
        html_content = html_content.replace("__SITE_URL__", site_url)
        html_content = html_content.replace("__UNSUBSCRIBE_URL__", unsubscribe_url)

        try:
            response = resend.Emails.send({
                "from": self.from_address,
                "to": [to_email],
                "subject": f"Your Weekly Highland Guide 🏴󠁧󠁢󠁳󠁣󠁴󠁿",
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
        featured_events: list = None,
        trending_events: list = None
    ) -> bool:
        """
        Send modern welcome email with featured and trending sections.

        Args:
            to_email: User's email address
            display_name: User's display name (capitalized)
            featured_events: 3 featured/top pick events
            trending_events: Trending events list
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send welcome email with events to {mask_email(to_email)}")
            return True

        name = display_name or "there"
        featured_events = featured_events or []
        trending_events = trending_events or []
        
        # Ensure URLs have no trailing slashes consistency
        site_url = settings.FRONTEND_URL.rstrip('/')
        
        # FIX: Force www. for production domain to prevent link/image issues
        if "highlandeventshub.co.uk" in site_url and "www." not in site_url:
            site_url = site_url.replace("highlandeventshub.co.uk", "www.highlandeventshub.co.uk")
            
        logo_url = f"{site_url}/icons/logo_knot.jpg"

        # BRAND COLORS
        # Highland Green: #0F3E35
        # Warm White: #FAF9F6
        # Stone Dark: #2F2F2F
        # Badge Warning: #FEF9C3 (bg), #854D0E (text)

        # Build featured events HTML (Site-like Event Cards)
        featured_html = ""
        for event in featured_events[:3]:
            event_id = event.get('id', '')
            event_url = f"{site_url}/events/{event_id}"
            image_url = event.get('image_url')
            
            image_html = ""
            if image_url:
                image_html = f'<img src="{image_url}" alt="" style="width: 100%; height: 180px; object-fit: cover; display: block;">'
            else:
                image_html = '<div style="height: 180px; background: linear-gradient(135deg, #0F3E35, #3F7F66);"></div>'
            
            featured_html += f"""
            <div style="margin-bottom: 24px; border-radius: 12px; overflow: hidden; border: 1px solid #e5e5e5; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                <a href="{event_url}" style="text-decoration: none; display: block; position: relative;">
                    {image_html}
                    <!-- Featured Badge -->
                    <div style="position: absolute; top: 10px; left: 10px; background: #FEF9C3; color: #854D0E; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 999px;">
                        ⭐ Featured
                    </div>
                </a>
                <div style="padding: 16px;">
                    <a href="{event_url}" style="display: block; color: #2F2F2F; font-weight: 600; text-decoration: none; font-size: 18px; margin-bottom: 6px; line-height: 1.4;">{event.get('title', 'Event')}</a>
                    <div style="color: #52525b; font-size: 14px; display: flex; align-items: center; margin-bottom: 4px;">
                        📅 {event.get('date_display', '')}
                    </div>
                    <div style="color: #52525b; font-size: 14px;">
                        📍 {event.get('venue_name', '')}
                    </div>
                </div>
            </div>
            """

        # Build trending events HTML (Compact List)
        trending_html = ""
        if trending_events:
            for event in trending_events[:4]:
                event_id = event.get('id', '')
                event_url = f"{site_url}/events/{event_id}"
                image_url = event.get('image_url')
                
                image_html = ""
                if image_url:
                    image_html = f'<img src="{image_url}" alt="" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">'
                else:
                    image_html = '<div style="width: 80px; height: 80px; background: #f4f4f5; border-radius: 8px;"></div>'
                
                trending_html += f"""
                <a href="{event_url}" style="display: flex; align-items: start; text-decoration: none; padding: 12px 0; border-bottom: 1px solid #f4f4f5;">
                    {image_html}
                    <div style="margin-left: 16px; flex: 1;">
                        <div style="color: #2F2F2F; font-weight: 600; font-size: 15px; margin-bottom: 4px; line-height: 1.4;">{event.get('title', 'Event')}</div>
                        <div style="color: #71717a; font-size: 13px;">📅 {event.get('date_display', '')}</div>
                        <div style="color: #71717a; font-size: 13px;">📍 {event.get('venue_name', '')}</div>
                    </div>
                </a>
                """

        # Onboarding icons row
        onboarding_html = f"""
        <div style="display: flex; justify-content: space-between; margin: 40px 0; text-align: center; gap: 12px;">
            <a href="{site_url}/venues" style="text-decoration: none; flex: 1; background: #ffffff; padding: 20px 10px; border-radius: 12px; border: 1px solid #e5e5e5;">
                <div style="font-size: 24px; margin-bottom: 12px;">📍</div>
                <div style="color: #0F3E35; font-size: 13px; font-weight: 600;">Find Venues</div>
            </a>
            <a href="{site_url}" style="text-decoration: none; flex: 1; background: #ffffff; padding: 20px 10px; border-radius: 12px; border: 1px solid #e5e5e5;">
                <div style="font-size: 24px; margin-bottom: 12px;">❤️</div>
                <div style="color: #0F3E35; font-size: 13px; font-weight: 600;">Favorites</div>
            </a>
            <a href="{site_url}/account/notifications" style="text-decoration: none; flex: 1; background: #ffffff; padding: 20px 10px; border-radius: 12px; border: 1px solid #e5e5e5;">
                <div style="font-size: 24px; margin-bottom: 12px;">🔔</div>
                <div style="color: #0F3E35; font-size: 13px; font-weight: 600;">Get Alerts</div>
            </a>
        </div>
        """

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2F2F2F; margin: 0; padding: 0; background: #FAF9F6;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
                <!-- Brand Top Border -->
                <div style="height: 4px; background: #0F3E35;"></div>
                
                <!-- Header -->
                <div style="padding: 24px; text-align: center; border-bottom: 1px solid #f4f4f5;">
                    <img src="{logo_url}" alt="Highland Events Hub" style="width: 48px; height: 48px;">
                    <h1 style="color: #0F3E35; margin: 12px 0 8px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em;">Welcome, {name}!</h1>
                    <p style="color: #52525b; font-size: 16px; margin: 0;">You're all set to discover the best of the Highlands.</p>
                </div>
                
                <!-- Main Content -->
                <div style="padding: 32px 24px;">
                    
                    <!-- Intro Text -->
                    <div style="margin-bottom: 32px; color: #52525b; font-size: 16px;">
                        <p style="margin-top: 0;">You're now part of a community that celebrates everything happening across the Highlands - from ceilidhs in village halls to festivals on the shores of Loch Ness.</p>
                        <p>We've picked out some events we think you'll love to get you started.</p>
                    </div>

                    <!-- Featured Section -->
                    <div style="margin-bottom: 40px;">
                        <h2 style="color: #0F3E35; font-size: 18px; margin: 0 0 16px 0; font-weight: 700;">Top Picks This Week</h2>
                        {featured_html}
                    </div>
                    
                    <!-- Onboarding -->
                    <h2 style="color: #0F3E35; font-size: 18px; margin: 0 0 16px 0; font-weight: 700; text-align: center;">Get Started</h2>
                    {onboarding_html}
                    
                    <!-- Trending Section -->
                    <div style="margin-top: 40px;">
                        <h2 style="color: #0F3E35; font-size: 18px; margin: 0 0 16px 0; font-weight: 700;">Trending Now</h2>
                        {trending_html}
                    </div>
                    
                    <!-- CTA -->
                    <div style="text-align: center; margin-top: 40px;">
                        <a href="{site_url}" style="display: inline-block; background: #0F3E35; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Explore All Events</a>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="background: #2F2F2F; padding: 32px 24px; text-align: center; color: #a1a1aa;">
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #ffffff;">Highland Events Hub</p>
                    <p style="font-size: 12px; margin-bottom: 24px;">Discover what's on across the Scottish Highlands</p>
                    <div style="font-size: 12px;">
                         <a href="{site_url}/account/dashboard" style="color: #a1a1aa; text-decoration: underline; margin: 0 8px;">My Dashboard</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        try:
            response = resend.Emails.send({
                "from": self.from_address,
                "to": [to_email],
                "subject": f"Welcome to Highland Events Hub, {name}! 🏴󠁧󠁢󠁳󠁣󠁴󠁿",
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

        logo_url = f"{settings.FRONTEND_URL}/icons/logo_knot.jpg"
        
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
                    <img src="{logo_url}" alt="Highland Events Hub" style="width: 60px; height: 60px; border-radius: 12px; margin-bottom: 15px;">
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
