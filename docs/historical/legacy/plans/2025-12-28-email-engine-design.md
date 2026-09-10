# Email Engine Design

**Status:** Approved
**Date:** 2025-12-28
**Branch:** phase-3

## Overview

Build email infrastructure for user retention, starting with welcome emails and weekly digest. Uses Resend as the transactional email provider.

## Decisions Made

| Topic | Decision |
|-------|----------|
| Priority | Email Engine first (before Highland Ads) |
| Provider | Resend (needs account setup) |
| Welcome Tone | Warm & local Highland vibe |
| Notifications UI | New "Settings" tab in account page |
| Weekly Digest | Thursday 18:00 ("The Weekend Highlander") |

---

## 1. Database Schema

### UserPreferences Model

```python
class UserPreferences(SQLModel, table=True):
    __tablename__ = "user_preferences"

    user_id: str = Field(foreign_key="users.id", primary_key=True)

    # Email permissions (GDPR-compliant defaults)
    marketing_emails: bool = Field(default=True)      # General announcements
    weekly_digest: bool = Field(default=True)         # Thursday Highlander
    organizer_alerts: bool = Field(default=True)      # "Your event is live!"

    # Category preferences for smarter digest targeting
    preferred_categories: list[str] = Field(default=[], sa_column=Column(JSON))

    # Unsubscribe token for one-click email unsubscribe
    unsubscribe_token: str = Field(default_factory=lambda: secrets.token_urlsafe(32))

    created_at: datetime
    updated_at: datetime
```

**Key decisions:**
- `user_id` as primary key (1:1 with User, created on registration)
- `unsubscribe_token` for GDPR one-click unsubscribe without login
- `preferred_categories` stored as JSON array of category slugs
- No `transactional_emails` toggle - password resets always send

**Migration:** Create table and backfill existing users with defaults.

---

## 2. Email Service

### File: `backend/app/services/email.py`

```python
class EmailService:
    def __init__(self):
        self.client = resend.Resend(api_key=settings.RESEND_API_KEY)
        self.from_address = "Highland Events Hub <hello@yourdomain.com>"

    async def send_welcome(self, user: User, preferences: UserPreferences):
        """Warm & local welcome email on signup"""
        html = render_template("emails/welcome.html", {
            "display_name": user.display_name or "there",
            "unsubscribe_token": preferences.unsubscribe_token,
        })
        await self._send(user.email, "Welcome to the Hub!", html)

    async def send_weekly_digest(self, user: User, events: list[Event], preferences: UserPreferences):
        """Thursday Highlander - personalized event recommendations"""
        html = render_template("emails/weekly_digest.html", {
            "events": events,
            "unsubscribe_token": preferences.unsubscribe_token,
        })
        await self._send(user.email, "Your Weekend in the Highlands", html)

    async def send_organizer_alert(self, user: User, event: Event, alert_type: str):
        """Event approved, going live, etc."""
        ...

    async def _send(self, to: str, subject: str, html: str):
        """Low-level send with error handling"""
        self.client.emails.send({
            "from": self.from_address,
            "to": to,
            "subject": subject,
            "html": html,
        })
```

### Template Location
`backend/app/templates/emails/` with Jinja2 HTML templates.

### Unsubscribe Endpoint
`GET /api/email/unsubscribe?token=xxx&type=weekly_digest` - no login required.

---

## 3. Frontend - Settings Tab

New tab in account page with toggle-based UI:

```
┌─────────────────────────────────────────────────────┐
│  Settings                                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  EMAIL NOTIFICATIONS                                │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Weekly Digest ("The Highlander")          [═══●]   │
│  Personalised event picks every Thursday            │
│                                                     │
│  Organizer Alerts                          [═══●]   │
│  Get notified when your events go live              │
│                                                     │
│  Marketing & Announcements                 [●═══]   │
│  Occasional updates about new features              │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  EVENT INTERESTS                                    │
│  Select categories for better recommendations       │
│                                                     │
│  [Music ✓] [Sport] [Food & Drink ✓] [Arts]         │
│  [Family] [Outdoor ✓] [Community] [Nightlife]      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### API Endpoints
- `GET /api/users/me/preferences` - fetch current settings
- `PATCH /api/users/me/preferences` - update toggles/categories

### Behaviour
- Toggles auto-save on change (no submit button)
- Categories are multi-select chips, also auto-save
- Toast confirmation: "Preferences saved"

---

## 4. Integration Points

### Registration Hook

In `backend/app/api/auth.py`, after user creation:

```python
preferences = UserPreferences(user_id=user.id)
db.add(preferences)
await db.commit()

# Fire-and-forget (don't block registration)
background_tasks.add_task(email_service.send_welcome, user, preferences)
```

### Weekly Digest Scheduler

Script for external scheduling (cron, Railway, etc.):

```python
# backend/app/scripts/send_weekly_digest.py
# Schedule: Thursday 18:00

async def main():
    users = await get_users_with_digest_enabled()
    for user in users:
        events = await get_recommended_events(user.preferences.preferred_categories)
        await email_service.send_weekly_digest(user, events, user.preferences)
```

---

## 5. Resend Setup Checklist

1. Create Resend account at resend.com
2. Add and verify sending domain (DNS records)
3. Generate API key
4. Add `RESEND_API_KEY` to environment variables

---

## Implementation Order

1. **UserPreferences model** + migration + backfill
2. **Email service** + Resend integration
3. **Welcome email template** + registration hook
4. **Preferences API endpoints**
5. **Frontend Settings tab**
6. **Weekly digest script** (can defer)
7. **Organizer alerts** (can defer)
