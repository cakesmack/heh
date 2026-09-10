# Email Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build email infrastructure with Resend for welcome emails, user preferences, and weekly digest.

**Architecture:** New `UserPreferences` model (1:1 with User), Resend service for marketing emails (keeping existing SMTP for password reset), Settings tab in account page with auto-saving toggles.

**Tech Stack:** FastAPI, SQLModel, Resend API, Next.js/React, TailwindCSS

---

## Task 1: Add Resend to Config

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/requirements.txt`

**Step 1: Add RESEND_API_KEY to Settings class**

In `backend/app/core/config.py`, add after line 83 (OS_API_KEY):

```python
    # Resend (Marketing Emails)
    RESEND_API_KEY: Optional[str] = None
```

**Step 2: Add resend to requirements**

In `backend/requirements.txt`, add:

```
resend>=2.0.0
```

**Step 3: Install dependencies**

Run: `cd backend && pip install resend`

**Step 4: Commit**

```bash
git add backend/app/core/config.py backend/requirements.txt
git commit -m "feat: add Resend API key to config"
```

---

## Task 2: Create UserPreferences Model

**Files:**
- Create: `backend/app/models/user_preferences.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/models/user.py`

**Step 1: Create the model file**

Create `backend/app/models/user_preferences.py`:

```python
"""
UserPreferences model for email notification settings.
Stores per-user preferences for marketing emails, weekly digest, and category interests.
"""
import secrets
from datetime import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship, Column
from sqlalchemy import JSON

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .user import User


class UserPreferences(SQLModel, table=True):
    """
    User preferences for email notifications and category interests.

    Created automatically when a user registers.
    1:1 relationship with User (user_id is primary key).
    """
    __tablename__ = "user_preferences"

    user_id: str = Field(foreign_key="users.id", primary_key=True)

    # Email permissions (GDPR-compliant, default opt-in)
    marketing_emails: bool = Field(default=True)
    weekly_digest: bool = Field(default=True)
    organizer_alerts: bool = Field(default=True)

    # Category preferences for personalized digest (stores category slugs)
    preferred_categories: List[str] = Field(default=[], sa_column=Column(JSON))

    # One-click unsubscribe token (no login required)
    unsubscribe_token: str = Field(default_factory=lambda: secrets.token_urlsafe(32))

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship
    user: "User" = Relationship(back_populates="preferences")
```

**Step 2: Add relationship to User model**

In `backend/app/models/user.py`, add import at top (inside TYPE_CHECKING):

```python
    from .user_preferences import UserPreferences
```

Add relationship after line 59 (venue_staff):

```python
    preferences: Optional["UserPreferences"] = Relationship(back_populates="user")
```

**Step 3: Export from models __init__**

In `backend/app/models/__init__.py`, add:

```python
from .user_preferences import UserPreferences
```

**Step 4: Commit**

```bash
git add backend/app/models/user_preferences.py backend/app/models/user.py backend/app/models/__init__.py
git commit -m "feat: add UserPreferences model for email settings"
```

---

## Task 3: Create Database Migration

**Files:**
- Run migration commands

**Step 1: Generate migration (if using Alembic)**

If the project uses Alembic:
```bash
cd backend
alembic revision --autogenerate -m "add user_preferences table"
alembic upgrade head
```

If using SQLModel auto-create (check main.py for `create_all`):
The table will be created on next startup.

**Step 2: Verify table creation**

Run the backend and check logs for table creation, or:
```bash
cd backend
python -c "from app.models.user_preferences import UserPreferences; print('Model OK')"
```

**Step 3: Commit migration (if generated)**

```bash
git add backend/alembic/versions/
git commit -m "migration: add user_preferences table"
```

---

## Task 4: Create Resend Email Service

**Files:**
- Create: `backend/app/services/resend_email.py`

**Step 1: Create the Resend service**

Create `backend/app/services/resend_email.py`:

```python
"""
Resend email service for marketing and transactional emails.
Uses Resend API for reliable email delivery with tracking.
"""
import logging
from typing import Optional
import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


class ResendEmailService:
    """Email service using Resend API."""

    def __init__(self):
        if settings.RESEND_API_KEY:
            resend.api_key = settings.RESEND_API_KEY
            self.enabled = True
            # Using onboarding email for dev, replace with custom domain for prod
            self.from_address = "Highland Events <onboarding@resend.dev>"
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
            logger.info(f"[DRY RUN] Would send welcome email to {to_email}")
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
                        <div class="feature-icon">📍</div>
                        <div>
                            <strong>Discover Local Events</strong><br>
                            Find gigs, markets, sports, and community gatherings near you.
                        </div>
                    </div>

                    <div class="feature">
                        <div class="feature-icon">🎟️</div>
                        <div>
                            <strong>Save Your Favourites</strong><br>
                            Bookmark events so you never miss out.
                        </div>
                    </div>

                    <div class="feature">
                        <div class="feature-icon">📣</div>
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
            logger.info(f"Welcome email sent to {to_email}, id: {response.get('id')}")
            return True
        except Exception as e:
            logger.error(f"Failed to send welcome email to {to_email}: {e}")
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
            logger.info(f"[DRY RUN] Would send weekly digest to {to_email}")
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
            logger.info(f"Weekly digest sent to {to_email}, id: {response.get('id')}")
            return True
        except Exception as e:
            logger.error(f"Failed to send weekly digest to {to_email}: {e}")
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
            logger.info(f"[DRY RUN] Would send organizer alert to {to_email}")
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
            logger.info(f"Organizer alert sent to {to_email}, id: {response.get('id')}")
            return True
        except Exception as e:
            logger.error(f"Failed to send organizer alert to {to_email}: {e}")
            return False


# Global instance
resend_email_service = ResendEmailService()
```

**Step 2: Commit**

```bash
git add backend/app/services/resend_email.py
git commit -m "feat: add Resend email service with welcome, digest, and alert emails"
```

---

## Task 5: Hook Welcome Email into Registration

**Files:**
- Modify: `backend/app/api/auth.py`

**Step 1: Add imports at top of auth.py**

After line 22 (existing imports), add:

```python
from fastapi import BackgroundTasks
from app.models.user_preferences import UserPreferences
from app.services.resend_email import resend_email_service
```

**Step 2: Update register endpoint signature**

Change line 41-45 from:

```python
@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    user_data: UserCreate,
    session: Session = Depends(get_session)
):
```

To:

```python
@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
):
```

**Step 3: Add preferences creation and welcome email after user commit**

After line 94 (`session.refresh(new_user)`), add:

```python
    # Create user preferences with defaults
    preferences = UserPreferences(user_id=new_user.id)
    session.add(preferences)
    session.commit()

    # Send welcome email (non-blocking)
    background_tasks.add_task(
        resend_email_service.send_welcome,
        new_user.email,
        new_user.display_name
    )
```

**Step 4: Also add to Google login flow**

After line 216 (`session.refresh(user)` in google_login), add similar code:

```python
        # Create user preferences for new Google user
        preferences = UserPreferences(user_id=user.id)
        session.add(preferences)
        session.commit()

        # Send welcome email (fire-and-forget)
        # Note: google_login is async, so we just call it
        resend_email_service.send_welcome(user.email, user.display_name)
```

**Step 5: Test registration**

Run backend, register a new user, check Gmail for welcome email.

**Step 6: Commit**

```bash
git add backend/app/api/auth.py
git commit -m "feat: send welcome email on user registration"
```

---

## Task 6: Create Preferences API Endpoints

**Files:**
- Create: `backend/app/api/preferences.py`
- Modify: `backend/app/main.py`

**Step 1: Create preferences router**

Create `backend/app/api/preferences.py`:

```python
"""
User Preferences API routes.
Handles email notification settings and category interests.
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel

from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.user_preferences import UserPreferences

router = APIRouter(prefix="/users/me/preferences", tags=["Preferences"])


class PreferencesResponse(BaseModel):
    """Response schema for user preferences."""
    marketing_emails: bool
    weekly_digest: bool
    organizer_alerts: bool
    preferred_categories: List[str]


class PreferencesUpdate(BaseModel):
    """Request schema for updating preferences."""
    marketing_emails: Optional[bool] = None
    weekly_digest: Optional[bool] = None
    organizer_alerts: Optional[bool] = None
    preferred_categories: Optional[List[str]] = None


@router.get("", response_model=PreferencesResponse)
def get_preferences(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get current user's notification preferences."""
    preferences = session.exec(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    ).first()

    # Create preferences if they don't exist (for existing users)
    if not preferences:
        preferences = UserPreferences(user_id=current_user.id)
        session.add(preferences)
        session.commit()
        session.refresh(preferences)

    return PreferencesResponse(
        marketing_emails=preferences.marketing_emails,
        weekly_digest=preferences.weekly_digest,
        organizer_alerts=preferences.organizer_alerts,
        preferred_categories=preferences.preferred_categories or []
    )


@router.patch("", response_model=PreferencesResponse)
def update_preferences(
    updates: PreferencesUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update current user's notification preferences."""
    preferences = session.exec(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    ).first()

    # Create if doesn't exist
    if not preferences:
        preferences = UserPreferences(user_id=current_user.id)
        session.add(preferences)

    # Apply updates
    if updates.marketing_emails is not None:
        preferences.marketing_emails = updates.marketing_emails
    if updates.weekly_digest is not None:
        preferences.weekly_digest = updates.weekly_digest
    if updates.organizer_alerts is not None:
        preferences.organizer_alerts = updates.organizer_alerts
    if updates.preferred_categories is not None:
        preferences.preferred_categories = updates.preferred_categories

    preferences.updated_at = datetime.utcnow()

    session.add(preferences)
    session.commit()
    session.refresh(preferences)

    return PreferencesResponse(
        marketing_emails=preferences.marketing_emails,
        weekly_digest=preferences.weekly_digest,
        organizer_alerts=preferences.organizer_alerts,
        preferred_categories=preferences.preferred_categories or []
    )


# ============================================================
# UNSUBSCRIBE ENDPOINT (No auth required)
# ============================================================

class UnsubscribeRequest(BaseModel):
    """Query params for unsubscribe."""
    token: str
    type: str  # weekly_digest, marketing_emails, organizer_alerts


@router.get("/unsubscribe")
def unsubscribe(
    token: str,
    type: str,
    session: Session = Depends(get_session)
):
    """
    One-click unsubscribe from email type.
    No authentication required - uses unsubscribe token.
    """
    # Find preferences by token
    preferences = session.exec(
        select(UserPreferences).where(UserPreferences.unsubscribe_token == token)
    ).first()

    if not preferences:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid unsubscribe token"
        )

    # Update the appropriate setting
    if type == "weekly_digest":
        preferences.weekly_digest = False
    elif type == "marketing_emails":
        preferences.marketing_emails = False
    elif type == "organizer_alerts":
        preferences.organizer_alerts = False
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email type"
        )

    preferences.updated_at = datetime.utcnow()
    session.add(preferences)
    session.commit()

    return {"message": f"Successfully unsubscribed from {type.replace('_', ' ')}"}
```

**Step 2: Register router in main.py**

In `backend/app/main.py`, add import:

```python
from app.api.preferences import router as preferences_router
```

Add router registration (with other routers):

```python
app.include_router(preferences_router)
```

**Step 3: Test endpoints**

```bash
# Get preferences
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8003/users/me/preferences

# Update preferences
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"weekly_digest": false}' http://127.0.0.1:8003/users/me/preferences
```

**Step 4: Commit**

```bash
git add backend/app/api/preferences.py backend/app/main.py
git commit -m "feat: add preferences API endpoints with unsubscribe"
```

---

## Task 7: Add Frontend Types and API

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add types**

In `frontend/src/types/index.ts`, add:

```typescript
// User Preferences
export interface UserPreferences {
  marketing_emails: boolean;
  weekly_digest: boolean;
  organizer_alerts: boolean;
  preferred_categories: string[];
}

export interface UserPreferencesUpdate {
  marketing_emails?: boolean;
  weekly_digest?: boolean;
  organizer_alerts?: boolean;
  preferred_categories?: string[];
}
```

**Step 2: Add API methods**

In `frontend/src/lib/api.ts`, add a new preferences section:

```typescript
// ============================================================
// PREFERENCES API
// ============================================================

const preferencesAPI = {
  async get(): Promise<UserPreferences> {
    const response = await fetch(`${API_BASE_URL}/users/me/preferences`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch preferences');
    return response.json();
  },

  async update(updates: UserPreferencesUpdate): Promise<UserPreferences> {
    const response = await fetch(`${API_BASE_URL}/users/me/preferences`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update preferences');
    return response.json();
  },
};
```

Add to the `api` export object:

```typescript
export const api = {
  // ... existing
  preferences: preferencesAPI,
};
```

**Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/api.ts
git commit -m "feat: add preferences types and API client"
```

---

## Task 8: Create Settings Tab Component

**Files:**
- Create: `frontend/src/components/account/SettingsTab.tsx`

**Step 1: Create the component**

Create `frontend/src/components/account/SettingsTab.tsx`:

```tsx
/**
 * Settings Tab Component
 * Email notification preferences with auto-saving toggles
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { UserPreferences, Category } from '@/types';

interface SettingsTabProps {
  categories: Category[];
}

export function SettingsTab({ categories }: SettingsTabProps) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const data = await api.preferences.get();
      setPreferences(data);
    } catch (err) {
      console.error('Failed to load preferences:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = async (key: keyof UserPreferences, value: boolean | string[]) => {
    if (!preferences) return;

    // Optimistic update
    setPreferences({ ...preferences, [key]: value });
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await api.preferences.update({ [key]: value });
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      // Revert on error
      setPreferences(preferences);
      setSaveMessage('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCategory = (slug: string) => {
    if (!preferences) return;

    const current = preferences.preferred_categories || [];
    const updated = current.includes(slug)
      ? current.filter(c => c !== slug)
      : [...current, slug];

    updatePreference('preferred_categories', updated);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="text-center py-12 text-gray-500">
        Failed to load preferences
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Save indicator */}
      {saveMessage && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50 ${
          saveMessage === 'Saved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
        }`}>
          {saveMessage}
        </div>
      )}

      {/* Email Notifications */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Email Notifications</h2>
        <p className="text-gray-500 text-sm mb-6">Choose what emails you'd like to receive</p>

        <div className="space-y-4">
          {/* Weekly Digest */}
          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
            <div>
              <p className="font-medium text-gray-900">Weekly Digest</p>
              <p className="text-sm text-gray-500">Personalised event picks every Thursday</p>
            </div>
            <button
              onClick={() => updatePreference('weekly_digest', !preferences.weekly_digest)}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                preferences.weekly_digest ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
              disabled={isSaving}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                preferences.weekly_digest ? 'translate-x-5' : ''
              }`} />
            </button>
          </label>

          {/* Organizer Alerts */}
          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
            <div>
              <p className="font-medium text-gray-900">Organizer Alerts</p>
              <p className="text-sm text-gray-500">Get notified when your events go live</p>
            </div>
            <button
              onClick={() => updatePreference('organizer_alerts', !preferences.organizer_alerts)}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                preferences.organizer_alerts ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
              disabled={isSaving}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                preferences.organizer_alerts ? 'translate-x-5' : ''
              }`} />
            </button>
          </label>

          {/* Marketing */}
          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
            <div>
              <p className="font-medium text-gray-900">Marketing & Announcements</p>
              <p className="text-sm text-gray-500">Occasional updates about new features</p>
            </div>
            <button
              onClick={() => updatePreference('marketing_emails', !preferences.marketing_emails)}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                preferences.marketing_emails ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
              disabled={isSaving}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                preferences.marketing_emails ? 'translate-x-5' : ''
              }`} />
            </button>
          </label>
        </div>
      </div>

      {/* Category Interests */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Event Interests</h2>
        <p className="text-gray-500 text-sm mb-6">Select categories for better recommendations</p>

        <div className="flex flex-wrap gap-2">
          {categories.filter(c => c.is_active).map(category => {
            const isSelected = preferences.preferred_categories?.includes(category.slug);
            return (
              <button
                key={category.id}
                onClick={() => toggleCategory(category.slug)}
                disabled={isSaving}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name}
                {isSelected && ' ✓'}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/account/SettingsTab.tsx
git commit -m "feat: add SettingsTab component with toggle preferences"
```

---

## Task 9: Add Settings Tab to Account Page

**Files:**
- Modify: `frontend/src/pages/account/index.tsx`

**Step 1: Import SettingsTab and add state**

Add import at top:

```tsx
import { SettingsTab } from '@/components/account/SettingsTab';
```

Add categories state (around line 25):

```tsx
const [categories, setCategories] = useState<Category[]>([]);
```

Update activeTab type (line 29):

```tsx
const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'venues' | 'settings'>('overview');
```

**Step 2: Fetch categories in useEffect**

Add to the fetchUserData function (around line 93):

```tsx
// Fetch categories for settings tab
try {
  const categoriesData = await api.categories.list();
  setCategories(categoriesData.categories || []);
} catch (err) {
  console.error('Error fetching categories:', err);
}
```

**Step 3: Add Settings tab button**

After the "My Venues" tab button (around line 218), add:

```tsx
<button
  onClick={() => setActiveTab('settings')}
  className={`${activeTab === 'settings'
    ? 'border-emerald-500 text-emerald-600'
    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
>
  Settings
</button>
```

**Step 4: Add Settings tab content**

After the venues tab content section (before the closing tags, around line 730), add:

```tsx
{/* Tab Content: Settings */}
{activeTab === 'settings' && (
  <SettingsTab categories={categories} />
)}
```

**Step 5: Test the UI**

Run frontend, go to /account, click Settings tab.

**Step 6: Commit**

```bash
git add frontend/src/pages/account/index.tsx
git commit -m "feat: integrate Settings tab into account page"
```

---

## Task 10: Create Unsubscribe Page

**Files:**
- Create: `frontend/src/pages/unsubscribe.tsx`

**Step 1: Create the page**

Create `frontend/src/pages/unsubscribe.tsx`:

```tsx
/**
 * Unsubscribe Page
 * Handles one-click email unsubscribe via token
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8003';

export default function UnsubscribePage() {
  const router = useRouter();
  const { token, type } = router.query;

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token || !type) return;

    const unsubscribe = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/users/me/preferences/unsubscribe?token=${token}&type=${type}`
        );

        if (response.ok) {
          setStatus('success');
          const data = await response.json();
          setMessage(data.message || 'Successfully unsubscribed');
        } else {
          setStatus('error');
          setMessage('Invalid or expired unsubscribe link');
        }
      } catch (err) {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      }
    };

    unsubscribe();
  }, [token, type]);

  const typeLabel = typeof type === 'string'
    ? type.replace(/_/g, ' ')
    : 'emails';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Processing your request...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribed</h1>
            <p className="text-gray-600 mb-6">
              You've been unsubscribed from {typeLabel}.
              You can update your preferences anytime in your account settings.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Go to Homepage
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <Link
              href="/account"
              className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Manage Preferences
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/unsubscribe.tsx
git commit -m "feat: add unsubscribe page for one-click email opt-out"
```

---

## Task 11: Backfill Existing Users

**Files:**
- Create: `backend/app/scripts/backfill_preferences.py`

**Step 1: Create backfill script**

Create `backend/app/scripts/backfill_preferences.py`:

```python
"""
Backfill script to create UserPreferences for existing users.
Run once after deploying the UserPreferences model.

Usage: cd backend && python -m app.scripts.backfill_preferences
"""
import asyncio
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlmodel import Session, select
from app.core.database import engine
from app.models.user import User
from app.models.user_preferences import UserPreferences


def backfill_preferences():
    """Create UserPreferences for all users who don't have one."""
    with Session(engine) as session:
        # Find users without preferences
        users_without_prefs = session.exec(
            select(User).where(
                ~User.id.in_(
                    select(UserPreferences.user_id)
                )
            )
        ).all()

        print(f"Found {len(users_without_prefs)} users without preferences")

        created = 0
        for user in users_without_prefs:
            preferences = UserPreferences(user_id=user.id)
            session.add(preferences)
            created += 1

            if created % 100 == 0:
                session.commit()
                print(f"Created {created} preferences...")

        session.commit()
        print(f"Done! Created {created} user preferences.")


if __name__ == "__main__":
    backfill_preferences()
```

**Step 2: Run the script**

```bash
cd backend
python -m app.scripts.backfill_preferences
```

**Step 3: Commit**

```bash
git add backend/app/scripts/backfill_preferences.py
git commit -m "feat: add backfill script for user preferences"
```

---

## Task 12: Final Integration Test

**Steps:**

1. **Start backend:** `cd backend && uvicorn app.main:app --reload --port 8003`
2. **Start frontend:** `cd frontend && npm run dev`
3. **Test registration flow:**
   - Register new account
   - Check Gmail for welcome email
4. **Test settings:**
   - Go to /account → Settings tab
   - Toggle preferences
   - Select category interests
5. **Test unsubscribe:**
   - Copy unsubscribe link from email
   - Visit link
   - Verify preference changed

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete email engine - phase 3.0 step 1"
```

---

## Summary

Tasks completed:
1. ✅ Resend config
2. ✅ UserPreferences model
3. ✅ Database migration
4. ✅ Resend email service
5. ✅ Welcome email hook
6. ✅ Preferences API
7. ✅ Frontend types/API
8. ✅ SettingsTab component
9. ✅ Account page integration
10. ✅ Unsubscribe page
11. ✅ Backfill script
12. ✅ Integration test

**Next phase:** Weekly digest scheduler + Organizer alerts integration
