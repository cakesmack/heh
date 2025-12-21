import logging
from typing import List, Optional

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
    def notify_event_submission(to_email: str, event_title: str):
        subject = "Event Submitted Successfully"
        body = f"Your event '{event_title}' has been submitted and is pending approval. We will notify you once it is reviewed."
        NotificationService.send_email(to_email, subject, body)

    @staticmethod
    def notify_event_approval(to_email: str, event_title: str, event_id: str):
        subject = "Event Approved!"
        body = f"Great news! Your event '{event_title}' has been approved and is now live. View it here: /events/{event_id}"
        NotificationService.send_email(to_email, subject, body)

    @staticmethod
    def notify_event_rejection(to_email: str, event_title: str, reason: str):
        subject = "Event Submission Update"
        body = f"Unfortunately, your event '{event_title}' was not approved. Reason: {reason}"
        NotificationService.send_email(to_email, subject, body)

    @staticmethod
    def notify_venue_claim_update(to_email: str, venue_name: str, status: str):
        subject = f"Venue Claim {status.capitalize()}"
        body = f"Your claim for the venue '{venue_name}' has been {status}. Please check your dashboard for details."
        NotificationService.send_email(to_email, subject, body)

notification_service = NotificationService()
