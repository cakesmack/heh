import logging
from typing import List, Optional
from sqlmodel import Session
from app.models.notification import Notification, NotificationType

# Configure logging for notifications
logger = logging.getLogger("notifications")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter('%(asctime)s - [EMAIL] - %(message)s'))
logger.addHandler(handler)

class NotificationService:
    @staticmethod
    def send_email(to_email: str, subject: str, body: str):
        """
        Simulates sending an email by logging it.
        In a real app, this would use SMTP or an API like SendGrid/AWS SES.
        """
        logger.info(f"To: {to_email} | Subject: {subject} | Body: {body[:100]}...")
        # In a real implementation, we would call the email provider here.

    @staticmethod
    def create_in_app_notification(
        session: Session,
        user_id: str,
        type: NotificationType,
        title: str,
        message: str,
        link: Optional[str] = None
    ):
        """Create a database notification record."""
        try:
            notification = Notification(
                user_id=user_id,
                type=type,
                title=title,
                message=message,
                link=link
            )
            session.add(notification)
            session.commit()
        except Exception as e:
            logger.error(f"Failed to create notification: {e}")

    @staticmethod
    def notify_event_submission(to_email: str, event_title: str):
        """Notify user that their event is pending review."""
        subject = "Event Submitted - Under Review"
        body = f"Your event '{event_title}' has been submitted and is pending approval. We will notify you once it is reviewed."
        NotificationService.send_email(to_email, subject, body)

    @staticmethod
    def notify_event_auto_approved(to_email: str, event_title: str, event_id: str):
        """Notify trusted user that their event was auto-approved."""
        subject = "Your Event is Live!"
        body = f"Success! Your event '{event_title}' is now live. (Auto-approved based on your trust score.) View it here: /events/{event_id}"
        NotificationService.send_email(to_email, subject, body)

    @staticmethod
    def notify_admin_new_pending_event(admin_emails: List[str], event_title: str, organizer_email: str):
        """Alert admins about a new pending event requiring moderation."""
        subject = "[Admin] New Event Pending Review"
        body = f"A new event '{event_title}' has been submitted by {organizer_email} and requires review. Please check the admin dashboard."
        for email in admin_emails:
            NotificationService.send_email(email, subject, body)

    @staticmethod
    def notify_event_approval(to_email: str, event_title: str, event_id: str, session: Session = None, user_id: str = None):
        subject = "Event Approved!"
        body = f"Great news! Your event '{event_title}' has been approved and is now live. View it here: /events/{event_id}"
        NotificationService.send_email(to_email, subject, body)
        
        if session and user_id:
            NotificationService.create_in_app_notification(
                session, user_id, NotificationType.EVENT_APPROVED, 
                "Event Approved", f"Your event '{event_title}' is now live!", f"/events/{event_id}"
            )

    @staticmethod
    def notify_event_rejection(to_email: str, event_title: str, reason: str, session: Session = None, user_id: str = None):
        subject = "Event Submission Update"
        body = f"Unfortunately, your event '{event_title}' was not approved. Reason: {reason}"
        NotificationService.send_email(to_email, subject, body)
        
        if session and user_id:
            NotificationService.create_in_app_notification(
                session, user_id, NotificationType.EVENT_REJECTED, 
                "Event Rejected", f"Your event '{event_title}' was rejected. Reason: {reason}", "/dashboard"
            )

    @staticmethod
    def notify_venue_claim_update(to_email: str, venue_name: str, status: str, session: Session = None, user_id: str = None):
        subject = f"Venue Claim {status.capitalize()}"
        body = f"Your claim for the venue '{venue_name}' has been {status}. Please check your dashboard for details."
        NotificationService.send_email(to_email, subject, body)
        
        if session and user_id:
            type = NotificationType.VENUE_CLAIM_APPROVED if status == "approved" else NotificationType.VENUE_CLAIM_REJECTED
            NotificationService.create_in_app_notification(
                session, user_id, type, 
                f"Venue Claim {status.capitalize()}", f"Your claim for '{venue_name}' was {status}.", "/dashboard"
            )

    @staticmethod
    def notify_event_claim_update(to_email: str, event_title: str, status: str, session: Session = None, user_id: str = None):
        subject = f"Event Claim {status.capitalize()}"
        body = f"Your claim for the event '{event_title}' has been {status}. Please check your dashboard for details."
        NotificationService.send_email(to_email, subject, body)
        
        if session and user_id:
            type = NotificationType.EVENT_CLAIM_APPROVED if status == "approved" else NotificationType.EVENT_CLAIM_REJECTED
            NotificationService.create_in_app_notification(
                session, user_id, type, 
                f"Event Claim {status.capitalize()}", f"Your claim for '{event_title}' was {status}.", "/dashboard"
            )

    @staticmethod
    def notify_admin_new_claim(admin_emails: List[str], claim_type: str, claim_target_name: str, user_email: str, session: Session = None, admin_users: List = None):
        """Alert admins about a new ownership claim."""
        subject = f"[Admin] New {claim_type.capitalize()} Claim Pending"
        body = f"A new claim for {claim_type} '{claim_target_name}' has been submitted by {user_email}. Please check the admin dashboard: /admin/claims"
        
        for email in admin_emails:
            NotificationService.send_email(email, subject, body)
            
        if session and admin_users:
            for admin in admin_users:
                NotificationService.create_in_app_notification(
                    session, admin.id, NotificationType.NEW_CLAIM,
                    f"New {claim_type.capitalize()} Claim",
                    f"User {user_email} claimed {claim_type} '{claim_target_name}'.",
                    "/admin/claims"
                )

notification_service = NotificationService()
