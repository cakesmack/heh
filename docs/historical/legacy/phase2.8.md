Phase 2.8: Auth, Comms & Mobile Polish
Objective: Fix data persistence for social login, implement the missing email infrastructure, and resolve critical mobile UI issues.

🚨 Sprint 1: The Auth & Data Integrity Fix (Priority)
Goal: Ensure every user (Google or Email) actually exists in the database.

1. Fix Google Sign-Up Persistence
The Bug: Google users can "log in" (Token is issued) but are not saved to the DB.

The Fix: Update POST /auth/google in the Backend.

Logic: Receive Google Token -> Decode -> Check DB for email.

If Exists: Return User.

If New: INSERT new row into users table -> Commit -> Return User.

Verify: Ensure password_hash is nullable (since Google users don't have one).

2. Admin Dashboard Visibility
Task: Ensure the Admin User List query includes users where password_hash is NULL (Google users).

Task: Add a "Source" column (Google vs. Email) to the Admin User Table for clarity.

📧 Sprint 2: Email Infrastructure & Security
Goal: Allow users to recover accounts and verify identity.

1. Email Service Setup
Provider: Use Resend (Recommended for easiest Python/Next.js integration) or SendGrid.

Backend: Create services/email.py.

Function: send_password_reset_email(to_email, token)

Function: send_welcome_email(to_email)

2. Password Reset Flow
Backend:

Endpoint: POST /auth/forgot-password (Generates token, sends email).

Endpoint: POST /auth/reset-password (Verifies token, updates password).

Frontend:

Page: /forgot-password (Simple email input).

Page: /reset-password (New password input, grabs token from URL).

📱 Sprint 3: UI/UX Enhancements
Goal: Fix the Mobile Map and upgrade Group/Category features.

1. Mobile Map Layout (The "Split View" Fix)
Problem: Side-by-side List/Map breaks on mobile (content off-screen).

Solution: Implement a Mobile Toggle.

Desktop: Keep Side-by-Side.

Mobile: Show ONLY List by default. Add a floating button or Tab Bar: "Show Map". When clicked, hide List, show Map full screen.

2. Group Creation Upgrades
Backend: Ensure groups table has logo_url and header_image_url columns.

Frontend: Add Image Upload components (integration with Cloudinary) to the "Create Group" form.

3. "Follow Category"
Backend:

Table: user_category_follows (Link User ID <-> Category ID).

Endpoint: POST /categories/{id}/follow & DELETE /categories/{id}/follow.

Frontend:

Add "Follow" button to the Category Header.

Update "My Feed" to prioritize events from followed categories.