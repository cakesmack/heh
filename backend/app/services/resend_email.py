from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional, Union, Tuple
import resend

from app.core.config import settings
from app.utils.pii import mask_email
from app.services.email_service import smart_email_service, EmailType

logger = logging.getLogger(__name__)


class ResendEmailService:
    """Email service abstraction using SmartEmailService."""

    def __init__(self):
        # We now use smart_email_service for actual sending
        # Keeping initialization logic for legacy support/enabled check
        self.enabled = smart_email_service.resend_enabled or smart_email_service.smtp_enabled
        self.from_address = smart_email_service.from_address

    async def send_welcome(self, to_email: str, username: str) -> bool:
        """
        Send welcome email to new user (Type: WELCOME -> SMTP).
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send welcome email to {mask_email(to_email)}")
            return True

        name = username or "there"

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

        return await smart_email_service.send_smart_email(
            email_type=EmailType.WELCOME,
            to=to_email,
            subject="Welcome to Highland Events Hub!",
            html_content=html_content
        )

    async def send_weekly_digest(
        self,
        to_email: str,
        username: str,
        featured_events: list,
        personalized_events: list,
        unsubscribe_token: str
    ) -> bool:
        """
        Send modern weekly digest (Type: WELCOME -> SMTP).
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send weekly digest to {mask_email(to_email)}")
            return True

        name = username or "there"
        # Ensure URLs have no trailing slashes consistency
        site_url = settings.FRONTEND_URL.rstrip('/')
        
        # FIX: Force www. for production domain to prevent link/image issues
        if "highlandeventshub.co.uk" in site_url and "www." not in site_url:
            site_url = site_url.replace("highlandeventshub.co.uk", "www.highlandeventshub.co.uk")
            
        logo_url = f"{site_url}/icons/logo_knot.jpg"
        unsubscribe_url = f"{site_url}/unsubscribe?token={unsubscribe_token}&type=weekly_digest"

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

        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2F2F2F; margin: 0; padding: 0; background: #FAF9F6;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
                <div style="height: 4px; background: #0F3E35;"></div>
                <div style="padding: 24px; text-align: center; border-bottom: 1px solid #f4f4f5;">
                    <img src="__LOGO_URL__" alt="Highland Events Hub" style="width: 48px; height: 48px;">
                    <h1 style="color: #0F3E35; margin: 12px 0 0 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Highland Events Hub</h1>
                </div>
                <div style="padding: 32px 24px;">
                    <p style="font-size: 16px; margin-bottom: 32px; color: #2F2F2F;">Hi __NAME__, check out what's happening this week across the Highlands.</p>
                    <div style="margin-bottom: 40px;">
                        <h2 style="color: #0F3E35; font-size: 18px; margin: 0 0 16px 0; font-weight: 700;">Top Picks</h2>
                        __FEATURED_HTML__
                    </div>
                    <div>
                        <h2 style="color: #0F3E35; font-size: 18px; margin: 0 0 16px 0; font-weight: 700;">For You</h2>
                        __PERSONALIZED_HTML__
                    </div>
                    <div style="text-align: center; margin-top: 40px;">
                        <a href="__SITE_URL__" style="display: inline-block; background: #0F3E35; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View All Events</a>
                    </div>
                </div>
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

        html_content = html_content.replace("__LOGO_URL__", logo_url)
        html_content = html_content.replace("__NAME__", name)
        html_content = html_content.replace("__FEATURED_HTML__", featured_html)
        html_content = html_content.replace("__PERSONALIZED_HTML__", personalized_html)
        html_content = html_content.replace("__SITE_URL__", site_url)
        html_content = html_content.replace("__UNSUBSCRIBE_URL__", unsubscribe_url)

        return await smart_email_service.send_smart_email(
            email_type=EmailType.WELCOME,
            to=to_email,
            subject=f"Your Weekly Highland Guide 🏴󠁧󠁢󠁳󠁣󠁴󠁿",
            html_content=html_content
        )

    async def send_organizer_alert(
        self,
        to_email: str,
        username: str,
        event_title: str,
        alert_type: str,
        unsubscribe_token: str
    ) -> bool:
        """
        Send organizer alert (Type: MODERATION -> SMTP).
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send organizer alert to {mask_email(to_email)}")
            return True

        name = username or "there"
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

        return await smart_email_service.send_smart_email(
            email_type=EmailType.MODERATION,
            to=to_email,
            subject=subject,
            html_content=html_content
        )


    async def send_event_approved(
        self,
        to_email: str,
        event_title: str,
        event_id: str,
        username: str = None,
        is_auto_approved: bool = False
    ) -> bool:
        """
        Send notification when an event is approved (Type: MODERATION -> SMTP).
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send event approved email to {mask_email(to_email)}")
            return True

        name = username or "there"
        event_url = f"{settings.FRONTEND_URL}/events/{event_id}"

        if is_auto_approved:
            subject = "Your event is live!"
            subtitle = "Auto-approved based on your trust score"
            message = f"Great news! Your event <strong>'{event_title}'</strong> has been automatically approved and is now live on the Highland Events Hub."
        else:
            subject = "Your event is live!"
            subtitle = "Your event has been approved"
            message = f"Great news! Your event <strong>'{event_title}'</strong> has been approved by our moderation team and is now published on the Highland Events Hub."

        facebook_share = f"https://www.facebook.com/sharer/sharer.php?u={event_url}"
        x_share = f"https://twitter.com/intent/tweet?url={event_url}"

        html_content = f"""\
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <!-- Outer wrapper table -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1a1a2e;">
        <tr>
            <td align="center" style="padding: 40px 16px;">

                <!-- Card container -->
                <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%; border-radius: 12px; overflow: hidden; border: 1px solid #2d2d44;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981, #059669); padding: 36px 32px; text-align: center;">
                            <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff; line-height: 1.3;">{subject}</h1>
                            <p style="margin: 10px 0 0 0; font-size: 15px; color: rgba(255,255,255,0.85);">{subtitle}</p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="background-color: #24243e; padding: 36px 32px;">
                            <!-- Success icon -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td align="center" style="padding-bottom: 24px;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="width: 56px; height: 56px; background-color: #064e3b; border-radius: 50%; text-align: center; vertical-align: middle; font-size: 28px;">&#x2705;</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 12px 0; font-size: 17px; color: #e2e8f0; line-height: 1.6;">Hey {name}!</p>
                            <p style="margin: 0 0 12px 0; font-size: 16px; color: #cbd5e1; line-height: 1.6;">{message}</p>
                            <p style="margin: 0 0 28px 0; font-size: 16px; color: #cbd5e1; line-height: 1.6;">People can now discover your event on the Hub. Share it with your community to boost attendance!</p>

                            <!-- Primary CTA -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td align="center" style="padding-bottom: 32px;">
                                        <a href="{event_url}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; letter-spacing: 0.02em;">View Your Event</a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Promoted Event CTA Block -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #10b981; border-radius: 8px; background-color: #16162b; margin-bottom: 32px;">
                                <tr>
                                    <td style="padding: 24px; text-align: center;">
                                        <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 18px; font-weight: 700;">Your event is live. Make it unmissable.</h3>
                                        <p style="margin: 0 0 16px 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;">Feature your event on the homepage spotlight, top collections, and weekly digest. Boost views by up to 5x.</p>
                                        <a href="{settings.FRONTEND_URL}/events/{event_id}/promote" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Promote Your Event</a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Share Section -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #3b3b5c; border-radius: 8px;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 600; color: #e2e8f0; text-align: center;">Maximize your local reach. Share your event directly to your community:</p>

                                        <!-- Share buttons table -->
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td width="50%" align="center" style="padding: 0 4px 0 0;">
                                                    <a href="{facebook_share}" target="_blank" style="display: block; background-color: #1877F2; color: #ffffff; padding: 12px 8px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; text-align: center;">Share on Facebook</a>
                                                </td>
                                                <td width="50%" align="center" style="padding: 0 0 0 4px;">
                                                    <a href="{x_share}" target="_blank" style="display: block; background-color: #000000; color: #ffffff; padding: 12px 8px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; text-align: center;">Share on X</a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #16162b; padding: 24px 32px; text-align: center;">
                            <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">Highland Events Hub<br>Discover what's on across the Scottish Highlands</p>
                        </td>
                    </tr>
                </table>

            </td>
        </tr>
    </table>
</body>
</html>
        """

        return await smart_email_service.send_smart_email(
            email_type=EmailType.MODERATION,
            to=to_email,
            subject=subject,
            html_content=html_content
        )

    async def send_event_rejected(
        self,
        to_email: str,
        event_title: str,
        event_id: str,
        rejection_reason: Optional[str] = None,
        username: Optional[str] = None
    ) -> bool:
        """
        Send notification when an event is rejected (Type: MODERATION -> SMTP).
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send event rejected email to {mask_email(to_email)}")
            return True

        name = username or "there"
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

        return await smart_email_service.send_smart_email(
            email_type=EmailType.MODERATION,
            to=to_email,
            subject=f"Update regarding your event: {event_title}",
            html_content=html_content
        )

    async def send_welcome_with_events(
        self,
        to_email: str,
        username: str = None,
        featured_events: list = None,
        trending_events: list = None
    ) -> bool:
        """
        Send modern welcome email with featured and trending sections.

        Args:
            to_email: User's email address
            username: User's username (capitalized)
            featured_events: 3 featured/top pick events
            trending_events: Trending events list
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send welcome email with events to {mask_email(to_email)}")
            return True

        name = username or "there"
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

        return await smart_email_service.send_smart_email(
            email_type=EmailType.WELCOME,
            to=to_email,
            subject=f"Welcome to Highland Events Hub, {name}! 🏴󠁧󠁢󠁳󠁣󠁣󠁴󠁿",
            html_content=html_content
        )

    async def send_system_alert(
        self,
        to_email: str,
        subject: str,
        message_body: str
    ) -> bool:
        """
        Send a system alert email (Type: MODERATION -> SMTP).
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

        return await smart_email_service.send_smart_email(
            email_type=EmailType.MODERATION,
            to=to_email,
            subject=subject,
            html_content=html_content
        )

    async def send_password_reset(
        self,
        to_email: str,
        reset_token: str
    ) -> bool:
        """
        Send password reset email (Type: SECURITY -> Resend).
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send password reset to {mask_email(to_email)}")
            return True

        # Build reset URL with www fix
        site_url = settings.FRONTEND_URL.rstrip('/')
        if "highlandeventshub.co.uk" in site_url and "www." not in site_url:
            site_url = site_url.replace("highlandeventshub.co.uk", "www.highlandeventshub.co.uk")
        
        reset_link = f"{site_url}/reset-password?token={reset_token}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #2F2F2F; margin: 0; padding: 0; background: #FAF9F6; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; }}
                .header {{ background: #0F3E35; padding: 30px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; font-weight: 700; }}
                .content {{ padding: 40px 30px; }}
                .button {{ display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
                .footer {{ background: #2F2F2F; padding: 24px; text-align: center; color: #a1a1aa; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Reset Your Password</h1>
                </div>
                <div class="content">
                    <p>Hi there,</p>
                    <p>We received a request to reset your password for your Highland Events Hub account.</p>
                    <p>Click the button below to set a new password:</p>
                    <p style="text-align: center;">
                        <a href="{reset_link}" class="button">Reset Password</a>
                    </p>
                    <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste this link:</p>
                    <p style="word-break: break-all; color: #6b7280; font-size: 14px;">{reset_link}</p>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
                </div>
                <div class="footer">
                    <p>Highland Events Hub<br>Discover what's on across the Scottish Highlands</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await smart_email_service.send_smart_email(
            email_type=EmailType.SECURITY,
            to=to_email,
            subject="Reset Your Password - Highland Events Hub",
            html_content=html_content
        )


# Global instance
    async def send_group_invite(
        self,
        to_email: str,
        inviter_name: str,
        group_name: str,
        invite_url: str
    ) -> bool:
        """
        Send a personalized group invitation (Type: INVITE -> SMTP).
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send group invite to {mask_email(to_email)}")
            return True

        site_url = settings.FRONTEND_URL.rstrip('/')
        if "highlandeventshub.co.uk" in site_url and "www." not in site_url:
            site_url = site_url.replace("highlandeventshub.co.uk", "www.highlandeventshub.co.uk")
            
        logo_url = f"{site_url}/icons/logo_knot.jpg"

        subject = f"{inviter_name} invited you to join {group_name} on Highland Events Hub"
        
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
                .button {{ display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
                .footer {{ background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }}
                .avatar {{ width: 60px; height: 60px; background: #d1fae5; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 30px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>You've been invited!</h1>
                </div>
                <div class="content">
                    <div class="avatar">💌</div>
                    <p>Hi!</p>
                    <p><strong>{inviter_name}</strong> has invited you to become a member of <strong>{group_name}</strong> on Highland Events Hub.</p>
                    <p>Join the team to verify events, manage listings, and help grow the community.</p>
                    <p style="text-align: center;">
                        <a href="{invite_url}" class="button">Accept Invitation</a>
                    </p>
                    <p style="text-align: center; color: #6b7280; font-size: 14px;">
                        This link is valid for 7 days.
                    </p>
                </div>
                <div class="footer">
                    <p>Highland Events Hub<br>Discover what's on across the Scottish Highlands</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await smart_email_service.send_smart_email(
            email_type=EmailType.INVITE,
            to=to_email,
            subject=subject,
            html_content=html_content
        )

    async def send_venue_invite(
        self,
        to_email: str,
        venue_name: str,
        invite_url: str
    ) -> bool:
        """
        Send venue ownership invitation email (Type: INVITE -> SMTP).
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send venue invite to {mask_email(to_email)}")
            return True

        subject = f"You're invited to manage {venue_name} on Highland Events Hub"
        
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
                .venue-card {{ background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }}
                .venue-card h2 {{ color: #059669; margin: 0 0 10px 0; }}
                .button {{ display: inline-block; background: #10b981; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
                .footer {{ background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔑 Venue Ownership Invitation</h1>
                </div>
                <div class="content">
                    <p>Hello!</p>
                    <p>You've been invited to take ownership of a venue on Highland Events Hub:</p>
                    
                    <div class="venue-card">
                        <h2>{venue_name}</h2>
                        <p style="color: #6b7280; margin: 0;">Click below to claim your venue</p>
                    </div>
                    
                    <p>As the venue owner, you'll be able to:</p>
                    <ul>
                        <li>Edit venue details and photos</li>
                        <li>Manage events at your venue</li>
                        <li>Run promotions and featured ads</li>
                        <li>Add staff members</li>
                    </ul>
                    
                    <p style="text-align: center;">
                        <a href="{invite_url}" class="button">Accept Ownership</a>
                    </p>
                    
                    <p style="color: #6b7280; font-size: 14px;">This invite expires in 7 days. If you didn't expect this email, you can safely ignore it.</p>
                </div>
                <div class="footer">
                    <p>&copy; Highland Events Hub</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await smart_email_service.send_smart_email(
            email_type=EmailType.INVITE,
            to=to_email,
            subject=subject,
            html_content=html_content
        )

    async def send_venue_claim_approved(
        self,
        to_email: str,
        venue_name: str,
        venue_id: str,
        username: Optional[str] = None
    ) -> bool:
        """
        Send notification when a venue claim is approved (Type: MODERATION -> SMTP).
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send venue claim approved email to {mask_email(to_email)}")
            return True

        name = username or "there"
        manage_url = f"{settings.FRONTEND_URL}/venues/{venue_id}/edit"
        
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
                .icon {{ width: 60px; height: 60px; background: #d1fae5; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 30px; }}
                .button {{ display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
                .footer {{ background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Claim Approved!</h1>
                </div>
                <div class="content">
                    <div class="icon">&#x1F3E2;</div>
                    <p>Hey {name}!</p>
                    <p>Great news! Your claim for <strong>{venue_name}</strong> has been approved.</p>
                    <p>You have been granted full manager access. You can now update the venue details, manage events, and add other staff members.</p>
                    <p style="text-align: center;">
                        <a href="{manage_url}" class="button">Manage Venue</a>
                    </p>
                </div>
                <div class="footer">
                    <p>Highland Events Hub<br>Discover what's on across the Scottish Highlands</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await smart_email_service.send_smart_email(
            email_type=EmailType.MODERATION,
            to=to_email,
            subject=f"You're now managing {venue_name}! 🔑",
            html_content=html_content
        )

    async def send_new_user_notification(self, user_email: str, username: str) -> bool:
        """Notify admin about a new user signup."""
        if not settings.ADMIN_EMAIL:
            return True
        
        subject = f"New User Signup: {username or user_email}"
        html_content = f"""
        <div style="font-family: sans-serif; padding: 20px;">
            <h2>New User Signup</h2>
            <p>A new user has registered on Highland Events Hub:</p>
            <ul>
                <li><strong>Username:</strong> {username or 'N/A'}</li>
                <li><strong>Email:</strong> {user_email}</li>
            </ul>
            <p><a href="{settings.FRONTEND_URL}/admin/users">View User Management</a></p>
        </div>
        """
        return await smart_email_service.send_smart_email(
            email_type=EmailType.MODERATION,
            to=settings.ADMIN_EMAIL,
            subject=subject,
            html_content=html_content
        )

    async def send_new_event_notification(
        self,
        event_title: str,
        event_id: str,
        organizer_name: str,
        date_time_str: Optional[str] = "TBD",
        venue_name: Optional[str] = "TBD",
        user_email: Optional[str] = "N/A",
        is_ticketing_enabled: bool = False
    ) -> bool:
        """Notify admin about a newly published event."""
        admin_target = settings.ADMIN_EMAIL or "contact@highlandeventshub.co.uk"
        subject_prefix = "[🎟️ TICKETED] " if is_ticketing_enabled else ""
        subject = f"{subject_prefix}New Event Published: {event_title}"
        ticketed_str = "Yes (Native Ticketing)" if is_ticketing_enabled else "No"
        live_url = f"{settings.FRONTEND_URL.rstrip('/')}/events/{event_id}"
        admin_edit_url = f"{settings.FRONTEND_URL.rstrip('/')}/admin/events?search={event_id}"

        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; rounded: 12px;">
            <h2 style="color: #065f46; margin-top: 0;">🎉 New Event Published</h2>
            <p>A new event has been published live to the platform:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 6px 0; font-weight: bold; color: #4b5563;">Title:</td><td style="padding: 6px 0;">{event_title}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold; color: #4b5563;">Date/Time:</td><td style="padding: 6px 0;">{date_time_str}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold; color: #4b5563;">Venue / Location:</td><td style="padding: 6px 0;">{venue_name}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold; color: #4b5563;">Organizer Name:</td><td style="padding: 6px 0;">{organizer_name}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold; color: #4b5563;">User Email:</td><td style="padding: 6px 0;">{user_email}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold; color: #4b5563;">Ticketed:</td><td style="padding: 6px 0;">{ticketed_str}</td></tr>
            </table>
            <div style="margin-top: 20px; display: flex; gap: 12px;">
                <a href="{live_url}" style="display: inline-block; background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 10px;">View Live Event</a>
                <a href="{admin_edit_url}" style="display: inline-block; background: #374151; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600;">Admin Edit / Nuke</a>
            </div>
        </div>
        """
        return await smart_email_service.send_smart_email(
            email_type=EmailType.MODERATION,
            to=admin_target,
            subject=subject,
            html_content=html_content
        )

    async def send_event_quarantined_alert(
        self,
        event_title: str,
        event_id: str,
        reason: str,
        organizer_name: Optional[str] = "N/A",
        user_email: Optional[str] = "N/A"
    ) -> bool:
        """Notify admin when an event triggers moderation filters and is quarantined in pending_review."""
        admin_target = settings.ADMIN_EMAIL or "contact@highlandeventshub.co.uk"
        subject = f"⚠️ Event Flagged for Moderation: {event_title}"
        review_url = f"{settings.FRONTEND_URL.rstrip('/')}/admin/moderation"

        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #fee2e2; border-left: 6px solid #ef4444; border-radius: 12px; background: #fffaf0;">
            <h2 style="color: #991b1b; margin-top: 0;">⚠️ Event Flagged for Moderation</h2>
            <p>The event <strong>{event_title}</strong> has triggered the automated content filter and is currently held in <code>pending_review</code> quarantine.</p>
            <div style="background: #fee2e2; border-radius: 8px; padding: 12px; margin: 16px 0;">
                <p style="margin: 0; color: #991b1b;"><strong>Flagged Reason / Keywords:</strong> {reason}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 6px 0; font-weight: bold; color: #4b5563;">Event ID:</td><td style="padding: 6px 0; font-family: monospace;">{event_id}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold; color: #4b5563;">Organizer Name:</td><td style="padding: 6px 0;">{organizer_name}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold; color: #4b5563;">User Email:</td><td style="padding: 6px 0;">{user_email}</td></tr>
            </table>
            <div style="margin-top: 20px;">
                <a href="{review_url}" style="display: inline-block; background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600;">Open Moderation Queue</a>
            </div>
        </div>
        """
        return await smart_email_service.send_smart_email(
            email_type=EmailType.MODERATION,
            to=admin_target,
            subject=subject,
            html_content=html_content
        )

    async def send_new_venue_notification(self, venue_name: str, venue_id: str, creator_email: str) -> bool:
        """Notify admin about a new venue submission."""
        admin_target = settings.ADMIN_EMAIL or "contact@highlandeventshub.co.uk"
        subject = f"New Venue Created: {venue_name}"
        html_content = f"""
        <div style="font-family: sans-serif; padding: 20px;">
            <h2>New Venue Created</h2>
            <p>A new venue has been created by <strong>{creator_email}</strong>:</p>
            <ul>
                <li><strong>Venue Name:</strong> {venue_name}</li>
                <li><strong>Venue ID:</strong> {venue_id}</li>
            </ul>
            <p><a href="{settings.FRONTEND_URL}/venues/{venue_id}">View Venue Profile</a></p>
            <p><a href="{settings.FRONTEND_URL}/admin/venues">Review in Admin Dashboard</a></p>
        </div>
        """
        return await smart_email_service.send_smart_email(
            email_type=EmailType.MODERATION,
            to=admin_target,
            subject=subject,
            html_content=html_content
        )

    async def send_new_venue_claim_notification(self, admin_email: str, venue_name: str, venue_id: str, claimant_email: str) -> bool:
        """Notify admin about a new venue claim request."""
        subject = f"New Venue Claim Request: {venue_name}"
        html_content = f"""
        <div style="font-family: sans-serif; padding: 20px;">
            <h2>New Venue Claim Request</h2>
            <p>A new ownership claim has been submitted for the venue <strong>{venue_name}</strong>:</p>
            <ul>
                <li><strong>Venue Name:</strong> {venue_name}</li>
                <li><strong>Venue ID:</strong> {venue_id}</li>
                <li><strong>Claimed By (User):</strong> {claimant_email}</li>
            </ul>
            <p><a href="{settings.FRONTEND_URL}/venues/{venue_id}">View Venue Profile</a></p>
            <p><a href="{settings.FRONTEND_URL}/admin/claims">Review Claim in Admin Dashboard</a></p>
        </div>
        """
        return await smart_email_service.send_smart_email(
            email_type=EmailType.MODERATION,
            to=admin_email,
            subject=subject,
            html_content=html_content
        )

    async def send_moderation_required_notification(self, event_title: str, event_id_or_reason: str, reason: Optional[str] = None) -> bool:
        """Notify admin when an event is flagged for moderation."""
        if reason is not None:
            actual_reason = reason
            event_id = event_id_or_reason
        else:
            actual_reason = event_id_or_reason
            event_id = None

        admin_target = settings.ADMIN_EMAIL or "contact@highlandeventshub.co.uk"
        subject = f"⚠️ Event Flagged for Moderation: {event_title}"
        queue_link = f"{settings.FRONTEND_URL}/admin/events" + (f"?id={event_id}" if event_id else "")
        html_content = f"""
        <div style="font-family: sans-serif; padding: 20px;">
            <h2>Event Flagged for Moderation</h2>
            <p>The event <strong>{event_title}</strong> has been flagged for review:</p>
            <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0;">
                <strong>Reason:</strong> {actual_reason}
            </div>
            <p><a href="{queue_link}">View Moderation Queue</a></p>
        </div>
        """
        return await smart_email_service.send_smart_email(
            email_type=EmailType.MODERATION,
            to=admin_target,
            subject=subject,
            html_content=html_content
        )

    async def send_featured_notification(
        self,
        to_email: str,
        event_title: str,
        username: Optional[str] = None,
        invoice_url: Optional[str] = None
    ) -> bool:
        """
        Send notification when an event becomes featured (Type: MODERATION -> SMTP).
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send featured notification to {mask_email(to_email)}")
            return True

        name = username or "there"
        subject = "🚀 Your Event is Now Featured on Highland Events!"
        
        invoice_button = ""
        if invoice_url:
            invoice_button = f"""
            <div style="margin-top: 20px; padding: 20px; background: #f0fdf4; border: 1px dashed #10b981; border-radius: 8px;">
                <p style="margin: 0 0 15px 0; font-size: 14px; color: #15803d; font-weight: 600;">Need a VAT invoice for your records?</p>
                <a href="{invoice_url}" class="button" style="background: #059669; margin: 0;">Download PDF Invoice</a>
            </div>
            """

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 0 auto; }}
                .header {{ background: linear-gradient(135deg, #10b981, #059669); padding: 40px 30px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 28px; }}
                .content {{ padding: 40px 30px; background: #ffffff; text-align: center; }}
                .button {{ display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
                .footer {{ background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🌟 Status: Featured!</h1>
                </div>
                <div class="content">
                    <p>Hey {name},</p>
                    <p>Great news! Your event <strong>'{event_title}'</strong> is now officially featured on the Highland Events Hub.</p>
                    <p>It will now appear in our premium carousels and at the top of category listings, helping you reach more people across the Highlands.</p>
                    
                    {invoice_button}

                    <p style="text-align: center;">
                        <a href="{settings.FRONTEND_URL}" class="button">Visit the Homepage</a>
                    </p>
                </div>
                <div class="footer">
                    <p>Highland Events Hub<br>Discover what's on across the Scottish Highlands</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await smart_email_service.send_smart_email(
            email_type=EmailType.MODERATION,
            to=to_email,
            subject=subject,
            html_content=html_content
        )

    # Alias for backward compatibility in some modules
    async def send_password_reset_email(self, to_email: str, reset_token: str) -> bool:
        return await self.send_password_reset(to_email, reset_token)

    async def send_promotion_reminder(
        self,
        to_email: str,
        event_title: str,
        event_id: str,
        username: str = None
    ) -> bool:
        """
        Send notification reminding users to promote their event (Type: WELCOME -> SMTP).
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send promotion reminder email to {mask_email(to_email)}")
            return True

        name = username or "there"
        promote_url = f"{settings.FRONTEND_URL}/events/{event_id}/promote"
        subject = "Your event is 2 weeks away — boost visibility now"

        html_content = f"""\
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1a1a2e;">
        <tr>
            <td align="center" style="padding: 40px 16px;">
                <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%; border-radius: 12px; overflow: hidden; border: 1px solid #2d2d44;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #0F3E35, #1e3a8a); padding: 36px 32px; text-align: center;">
                            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; line-height: 1.3;">Your event is 2 weeks away</h1>
                            <p style="margin: 10px 0 0 0; font-size: 15px; color: rgba(255,255,255,0.85);">Push last-minute tickets and maximize your attendance</p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="background-color: #24243e; padding: 36px 32px;">
                            <p style="margin: 0 0 16px 0; font-size: 16px; color: #e2e8f0; line-height: 1.6;">Hey {name},</p>
                            <p style="margin: 0 0 16px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">Your upcoming event, <strong>'{event_title}'</strong>, is exactly two weeks away! Now is the prime time to capture interest as people plan their schedules.</p>
                            <p style="margin: 0 0 24px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">To help you sell out tickets and make the event a massive success, you can feature it on the Highland Events Hub homepage spotlight row and in our weekly digest email blast.</p>

                            <!-- Primary CTA -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td align="center" style="padding-bottom: 24px;">
                                        <a href="{promote_url}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 16px 36px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; letter-spacing: 0.02em;">Boost Visibility Now</a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0; font-size: 13px; color: #64748b; text-align: center; line-height: 1.5;">You received this reminder because you have promotion reminders enabled in your settings.</p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #16162b; padding: 24px 32px; text-align: center;">
                            <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">Highland Events Hub<br>Discover what's on across the Scottish Highlands</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

        from app.services.email_service import EmailType
        return await smart_email_service.send_smart_email(
            email_type=EmailType.WELCOME,
            to=to_email,
            subject=subject,
            html_content=html_content
        )

    async def send_ticket_order_confirmation(
        self,
        to_email: str,
        order_ref: str,
        event_title: str,
        event_date_str: str,
        venue_info: str,
        buyer_name: str,
        total_amount: float,
        ticket_summary: list,
    ) -> bool:
        """
        Send ticket booking confirmation and digital ticket link to buyer.
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send ticket confirmation email to {mask_email(to_email)} for {order_ref}")
            return True

        subject = f"Your Tickets: {event_title} ({order_ref}) 🎟️"
        tickets_url = f"{settings.FRONTEND_URL}/orders/{order_ref}"

        tickets_rows = ""
        for item in ticket_summary:
            name = item.get("name") or item.get("tier_name") or "General Admission"
            qty = item.get("quantity") or item.get("qty") or 1
            price = item.get("price", 0.0)
            price_str = f"£{price:.2f}" if price > 0 else "Free"
            qr_tokens = item.get("qr_tokens") or []
            qr_info_html = ""
            if qr_tokens:
                qr_info_html = f'<div style="font-size: 12px; color: #059669; margin-top: 4px; font-weight: 500;">✓ {len(qr_tokens)} digital QR check-in token(s) issued</div>'

            tickets_rows += f"""
            <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;"><strong>{name}</strong>{qr_info_html}</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563; font-size: 14px;">{qty}</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-weight: 600; font-size: 14px;">{price_str}</td>
            </tr>
            """

        html_content = f"""\
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 32px 16px;">
                <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
                    <!-- Brand Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #064e3b, #047857); padding: 36px 32px; text-align: center; color: #ffffff;">
                            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #a7f3d0; margin-bottom: 6px;">Highland Events Hub • Official Ticket</div>
                            <h1 style="margin: 0; font-size: 26px; font-weight: 800; line-height: 1.2; color: #ffffff;">Booking Confirmed!</h1>
                            <p style="margin: 8px 0 0 0; font-size: 15px; color: #d1fae5;">Order Reference: <strong>{order_ref}</strong></p>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 32px 32px 24px 32px;">
                            <p style="margin: 0 0 20px 0; font-size: 16px; color: #111827; line-height: 1.5;">Hi <strong>{buyer_name}</strong>,</p>
                            <p style="margin: 0 0 24px 0; font-size: 15px; color: #4b5563; line-height: 1.6;">Thank you for your booking! Your tickets for <strong>{event_title}</strong> are confirmed and ready for gate check-in.</p>

                            <!-- Event Details Card -->
                            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                                <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #065f46;">{event_title}</h2>
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td style="padding: 4px 0; font-size: 14px; color: #374151;">
                                            📅 <strong>Date & Time:</strong> {event_date_str}
                                        </td>
                                    </tr>
                                    {f'<tr><td style="padding: 4px 0; font-size: 14px; color: #374151;">📍 <strong>Venue:</strong> {venue_info}</td></tr>' if venue_info else ''}
                                </table>
                            </div>

                            <!-- Tickets Summary Table -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                                <thead>
                                    <tr>
                                        <th style="padding: 8px 0; border-bottom: 2px solid #d1d5db; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 700;">Ticket Type</th>
                                        <th style="padding: 8px 0; border-bottom: 2px solid #d1d5db; text-align: center; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 700;">Qty</th>
                                        <th style="padding: 8px 0; border-bottom: 2px solid #d1d5db; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 700;">Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets_rows}
                                    <tr>
                                        <td colspan="2" style="padding: 14px 0 0 0; font-size: 16px; font-weight: 700; color: #111827;">Total Paid</td>
                                        <td style="padding: 14px 0 0 0; text-align: right; font-size: 18px; font-weight: 800; color: #047857;">£{total_amount:.2f}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 32px 0 24px 0;">
                                <a href="{tickets_url}" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 16px 36px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; letter-spacing: 0.01em; box-shadow: 0 2px 6px rgba(5,150,105,0.3);">View & Download Tickets 🎟️</a>
                            </div>

                            <p style="margin: 0; font-size: 13px; color: #6b7280; text-align: center; line-height: 1.5;">You can present the digital QR code directly on your phone or print a physical copy at home by clicking the link above or going to <a href="{tickets_url}" style="color: #059669; text-decoration: underline;">{tickets_url}</a>.</p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 32px; text-align: center;">
                            <p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280; font-weight: 600;">Highland Events Hub</p>
                            <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">Discover what's on across the Scottish Highlands • <a href="{settings.FRONTEND_URL}/account/tickets" style="color: #059669; text-decoration: underline;">My Tickets</a></p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

        from app.services.email_service import EmailType
        return await smart_email_service.send_smart_email(
            email_type=EmailType.TICKETING,
            to=to_email,
            subject=subject,
            html_content=html_content
        )

    async def send_organizer_ticket_sale_notification(
        self,
        organizer_email: str,
        organizer_name: str,
        event_title: str,
        event_id: str,
        order_ref: str,
        buyer_name: str,
        buyer_email: str,
        tickets_breakdown: List[Dict[str, Any]],
        total_amount: float,
        platform_fee: float,
        net_amount: float
    ) -> bool:
        """
        Send notification to event organizer when a ticket is purchased for their event.
        """
        if not self.enabled:
            logger.info(f"[DRY RUN] Would send organizer ticket sale notification to {mask_email(organizer_email)} for {order_ref}")
            return True

        subject = f"🎟️ Ticket Sold: {event_title} - Order #{order_ref}"
        hub_url = f"{settings.FRONTEND_URL}/organizers/hub"
        dashboard_url = f"{settings.FRONTEND_URL}/organizers/events/{event_id}/ticketing"
        invoices_url = f"{settings.FRONTEND_URL}/organizers/invoices"

        tickets_rows = ""
        for t in tickets_breakdown:
            name = t.get("name", "General Admission")
            qty = t.get("quantity", 1)
            price = t.get("price", 0.0)
            tickets_rows += f"""
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #1f2937; font-weight: 600;">{name}</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: center; font-size: 14px; color: #4b5563;">{qty}</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right; font-size: 14px; color: #111827; font-weight: 600;">£{price * qty:.2f}</td>
            </tr>
            """

        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Ticket Sold</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f8; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #064e3b 0%, #047857 100%); padding: 32px; text-align: center;">
                            <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">🎟️ Ticket Sold!</h1>
                            <p style="margin: 0; color: #a7f3d0; font-size: 15px; font-weight: 500;">{event_title}</p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 32px;">
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #1f2937;">
                                Hi {organizer_name or 'Organizer'},
                            </p>
                            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #4b5563;">
                                Great news! A new ticket booking has just been confirmed for <strong>{event_title}</strong>.
                            </p>

                            <!-- Buyer Info Card -->
                            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td style="padding-bottom: 6px; font-size: 13px; color: #6b7280; text-transform: uppercase; font-weight: 700;">Customer Details</td>
                                        <td style="padding-bottom: 6px; font-size: 13px; color: #6b7280; text-transform: uppercase; font-weight: 700; text-align: right;">Order Ref</td>
                                    </tr>
                                    <tr>
                                        <td style="font-size: 15px; font-weight: 700; color: #111827;">{buyer_name} <span style="font-size: 13px; font-weight: normal; color: #6b7280;">({buyer_email})</span></td>
                                        <td style="font-size: 14px; font-family: monospace; font-weight: 700; color: #047857; text-align: right;">{order_ref}</td>
                                    </tr>
                                </table>
                            </div>

                            <!-- Tickets Summary Table -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                                <thead>
                                    <tr>
                                        <th style="padding: 8px 0; border-bottom: 2px solid #d1d5db; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 700;">Ticket Tier</th>
                                        <th style="padding: 8px 0; border-bottom: 2px solid #d1d5db; text-align: center; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 700;">Qty</th>
                                        <th style="padding: 8px 0; border-bottom: 2px solid #d1d5db; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 700;">Gross</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets_rows}
                                    <tr>
                                        <td colspan="2" style="padding: 12px 0 4px 0; font-size: 14px; color: #4b5563;">Total Gross Sales</td>
                                        <td style="padding: 12px 0 4px 0; text-align: right; font-size: 14px; font-weight: 600; color: #111827;">£{total_amount:.2f}</td>
                                    </tr>
                                    {f'<tr><td colspan="2" style="padding: 2px 0; font-size: 13px; color: #9ca3af;">Platform & Processing Fees</td><td style="padding: 2px 0; text-align: right; font-size: 13px; color: #9ca3af;">-£{platform_fee:.2f}</td></tr>' if platform_fee > 0 else ''}
                                    <tr>
                                        <td colspan="2" style="padding: 10px 0 0 0; border-top: 1px solid #e5e7eb; font-size: 16px; font-weight: 700; color: #111827;">Net Payout</td>
                                        <td style="padding: 10px 0 0 0; border-top: 1px solid #e5e7eb; text-align: right; font-size: 18px; font-weight: 800; color: #047857;">£{net_amount:.2f}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <!-- CTA Buttons -->
                            <div style="text-align: center; margin: 32px 0 16px 0;">
                                <a href="{hub_url}" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; margin: 0 6px 10px 6px; box-shadow: 0 2px 6px rgba(5,150,105,0.3);">Go to Organizer Hub</a>
                                <a href="{invoices_url}" style="display: inline-block; background-color: #f3f4f6; color: #374151; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 0 6px 10px 6px; border: 1px solid #d1d5db;">Tax Invoices & Statement</a>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 32px; text-align: center;">
                            <p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280; font-weight: 600;">Highland Events Hub Organizer Services</p>
                            <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">Access all your event ticketing stats, scanner passes, and payouts at <a href="{hub_url}" style="color: #059669; text-decoration: underline;">Organizer Hub</a></p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

        from app.services.email_service import EmailType
        return await smart_email_service.send_smart_email(
            email_type=EmailType.TICKETING,
            to=organizer_email,
            subject=subject,
            html_content=html_content
        )

    async def send_event_rescheduled_notification(
        self,
        to_email: str,
        buyer_name: str,
        event_title: str,
        previous_date_str: str,
        new_date_str: str,
        venue_info: str,
        order_ref: str,
        event_id: str
    ) -> bool:
        """
        Send notification email to ticket holders when an event's date/time is rescheduled.
        """
        subject = f"📅 Event Rescheduled: {event_title}"
        tickets_url = f"{settings.FRONTEND_URL}/orders/{order_ref}"
        event_url = f"{settings.FRONTEND_URL}/events/{event_id}"

        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Event Rescheduled</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f8; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 32px; text-align: center;">
                            <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">📅 Date Rescheduled</h1>
                            <p style="margin: 0; color: #bfdbfe; font-size: 15px; font-weight: 500;">{event_title}</p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 32px;">
                            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #1f2937;">
                                Hi {buyer_name or 'there'},
                            </p>
                            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #4b5563;">
                                The organizer of <strong>{event_title}</strong> has rescheduled the date for this event. Please take note of the updated schedule below.
                            </p>

                            <!-- Reschedule Details Card -->
                            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 14px; color: #64748b;">
                                            ⏮️ <strong>Previous Date:</strong> <span style="text-decoration: line-through; color: #94a3b8;">{previous_date_str}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 15px; color: #1e3a8a; font-weight: 700;">
                                            🗓️ <strong>New Date & Time:</strong> {new_date_str}
                                        </td>
                                    </tr>
                                    {f'<tr><td style="padding: 6px 0; font-size: 14px; color: #334155;">📍 <strong>Venue:</strong> {venue_info}</td></tr>' if venue_info else ''}
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">
                                            🎟️ <strong>Booking Reference:</strong> <span style="font-family: monospace; font-weight: 700; color: #0f172a;">{order_ref}</span>
                                        </td>
                                    </tr>
                                </table>
                            </div>

                            <!-- QR Ticket Validity Notice -->
                            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 16px 18px; margin-bottom: 28px;">
                                <div style="display: flex; align-items: flex-start;">
                                    <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #065f46; font-weight: 600;">
                                        ✨ Your existing QR tickets remain 100% valid for the new date. No rebooking or ticket exchange is necessary.
                                    </p>
                                </div>
                            </div>

                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 32px 0 20px 0;">
                                <a href="{tickets_url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 15px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 2px 8px rgba(37,99,235,0.3);">View Your Tickets 🎟️</a>
                            </div>

                            <p style="margin: 0; font-size: 13px; color: #64748b; text-align: center; line-height: 1.5;">
                                If you are unable to attend on the new date, please contact the event organizer or visit the <a href="{event_url}" style="color: #2563eb; text-decoration: underline;">event page</a> for support.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 32px; text-align: center;">
                            <p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280; font-weight: 600;">Highland Events Hub</p>
                            <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">Discover what's on across the Scottish Highlands • <a href="{settings.FRONTEND_URL}/account/tickets" style="color: #2563eb; text-decoration: underline;">My Tickets</a></p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

        from app.services.email_service import EmailType
        return await smart_email_service.send_smart_email(
            email_type=EmailType.TICKETING,
            to=to_email,
            subject=subject,
            html_content=html_content
        )

    async def send_event_cancellation_refund_notification(
        self,
        to_email: str,
        buyer_name: str,
        event_title: str,
        cancellation_reason: Optional[str],
        order_ref: str,
        refund_amount: float,
        is_free_order: bool = False
    ) -> bool:
        """
        Send notification email to ticket holders when an event is cancelled and refunded.
        """
        subject = f"⚠️ Event Cancelled: {event_title} ({order_ref})"

        refund_section = ""
        if not is_free_order and refund_amount > 0:
            refund_section = f"""
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="font-size: 13px; color: #991b1b; text-transform: uppercase; font-weight: 700;">Face-Value Refund Issued</td>
                        <td style="text-align: right; font-size: 18px; font-weight: 800; color: #b91c1c;">£{refund_amount:.2f}</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding-top: 8px; font-size: 13px; color: #7f1d1d; line-height: 1.5;">
                            A full face-value refund of <strong>£{refund_amount:.2f}</strong> has been initiated via Stripe back to your original payment method. Funds typically appear in your account within 5–10 business days.
                        </td>
                    </tr>
                </table>
            </div>
            """
        else:
            refund_section = f"""
            <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.5;">
                    Your RSVP reservation (Ref: <strong>{order_ref}</strong>) has been cancelled. No payment was charged.
                </p>
            </div>
            """

        reason_html = ""
        if cancellation_reason:
            reason_html = f"""
            <div style="background-color: #f8fafc; border-left: 4px solid #94a3b8; padding: 14px 18px; margin-bottom: 24px; border-radius: 4px;">
                <p style="margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; font-weight: 700; color: #64748b;">Message from Organizer</p>
                <p style="margin: 0; font-size: 14px; color: #1e293b; font-style: italic; line-height: 1.5;">"{cancellation_reason}"</p>
            </div>
            """

        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Event Cancelled</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f8; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%); padding: 32px; text-align: center;">
                            <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">⚠️ Event Cancelled</h1>
                            <p style="margin: 0; color: #fecaca; font-size: 15px; font-weight: 500;">{event_title}</p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 32px;">
                            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #1f2937;">
                                Hi {buyer_name or 'there'},
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #4b5563;">
                                We regret to inform you that <strong>{event_title}</strong> has been cancelled by the event organizer and will no longer take place.
                            </p>

                            {reason_html}

                            {refund_section}

                            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; margin-bottom: 28px;">
                                <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5;">
                                    Booking Reference: <strong style="color: #111827; font-family: monospace;">{order_ref}</strong> • All tickets associated with this booking have been marked void.
                                </p>
                            </div>

                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 28px 0 20px 0;">
                                <a href="{settings.FRONTEND_URL}/events" style="display: inline-block; background-color: #1f2937; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">Browse Other Highland Events →</a>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 32px; text-align: center;">
                            <p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280; font-weight: 600;">Highland Events Hub Customer Care</p>
                            <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">Discover what's on across the Scottish Highlands • <a href="{settings.FRONTEND_URL}" style="color: #b91c1c; text-decoration: underline;">highlandeventshub.co.uk</a></p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

        from app.services.email_service import EmailType
        return await smart_email_service.send_smart_email(
            email_type=EmailType.TICKETING,
            to=to_email,
            subject=subject,
            html_content=html_content
        )

# Create global instance
resend_email_service = ResendEmailService()

