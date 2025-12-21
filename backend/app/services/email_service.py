"""
Email service for sending password reset and other transactional emails.
Uses Gmail SMTP with App Password authentication.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None
) -> bool:
    """
    Send an email using Gmail SMTP.
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML body content
        text_content: Plain text fallback (optional)
    
    Returns:
        True if email sent successfully, False otherwise
    """
    if not settings.SMTP_USER or not settings.SMTP_PASS:
        logger.error("SMTP credentials not configured")
        return False
    
    try:
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Highland Events <{settings.SMTP_USER}>"
        msg["To"] = to_email
        
        # Add text part (fallback)
        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        
        # Add HTML part
        msg.attach(MIMEText(html_content, "html"))
        
        # Connect to Gmail SMTP
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
        
        logger.info(f"Email sent successfully to {to_email}")
        return True
        
    except smtplib.SMTPAuthenticationError:
        logger.error("SMTP authentication failed. Check your App Password.")
        return False
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    """
    Send a password reset email with the reset link.
    
    Args:
        to_email: User's email address
        reset_token: The password reset token
    
    Returns:
        True if email sent successfully
    """
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
    
    subject = "Reset Your Password - Highland Events"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
            .header h1 {{ color: white; margin: 0; }}
            .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
            .button {{ display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }}
            .button:hover {{ background: #059669; }}
            .footer {{ text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }}
            .warning {{ background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏔️ Highland Events</h1>
            </div>
            <div class="content">
                <h2>Reset Your Password</h2>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                
                <p style="text-align: center;">
                    <a href="{reset_link}" class="button">Reset Password</a>
                </p>
                
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #6b7280; font-size: 14px;">{reset_link}</p>
                
                <div class="warning">
                    <strong>⚠️ This link expires in 1 hour.</strong><br>
                    If you didn't request this password reset, you can safely ignore this email.
                </div>
            </div>
            <div class="footer">
                <p>© Highland Events Hub • Discover events in the Scottish Highlands</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""
    Reset Your Password - Highland Events
    
    We received a request to reset your password.
    
    Click this link to reset your password:
    {reset_link}
    
    This link expires in 1 hour.
    
    If you didn't request this password reset, you can safely ignore this email.
    """
    
    return send_email(to_email, subject, html_content, text_content)
