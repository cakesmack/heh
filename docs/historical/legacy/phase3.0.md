# Phase 3.0 Execution Plan: Retention & Revenue

**Status:** Draft
**Objective:** Transition from MVP "Walking Skeleton" to a sustainable business platform.
**Focus Areas:**
1.  **Retention:** Email infrastructure to keep users coming back.
2.  **Revenue:** A "Featured Slot" inventory system to monetize event visibility.

---

## 1. The "Highland Ads" Architecture (Revenue)

We are building an **Inventory-Based Ad System** (similar to booking a hotel room). Organizers pay to reserve specific "Slots" for specific dates.

### A. The Slot Inventory
We will strictly limit supply to create scarcity and maintain UX quality.

| Slot Name | Location | Max Concurrent | Min Duration | Pricing (Draft) |
| :--- | :--- | :--- | :--- | :--- |
| **HERO_HOME** | Homepage Hero Carousel | **5** | 3 Days | £40 / day |
| **GLOBAL_PINNED** | Homepage "All Events" List (Top) | **3** | 3 Days | £20 / day |
| **CATEGORY_PINNED**| Category Page (Top of List) | **3** (per category) | 3 Days | £10 / day |
| **NEWSLETTER** | Weekly "Highlander" Email | **2** (per email) | N/A (One-off) | £15 / send |

### B. Availability Logic (The "Queue")
* **Rule:** First Come, First Served.
* **Logic:** Users select a date range. The backend checks `FeaturedBooking` count for those dates.
    * *Example:* If user wants `Dec 31st` for `HERO_HOME`, and 5 slots are already `ACTIVE` or `PAID` for that day, the date is disabled in the calendar.
* **Status Workflow:**
    `PENDING_PAYMENT` (Held for 15 mins) -> `ACTIVE` (Paid & Approved) -> `COMPLETED` (Date passed).

---

## 2. The Email Engine (Retention)

We will use **Resend** (or similar transactional API) for reliable delivery.

### A. Core Email Flows
1.  **The Welcome Handshake:**
    * *Trigger:* New User Signup.
    * *Content:* "Welcome to the Hub," link to profile setup, explanation of features.
2.  **The "Weekend Highlander" (Retention Loop):**
    * *Trigger:* Scheduled Cron Job (Friday 09:00).
    * *Content:* Top 5 recommended events based on user categories + 1 Sponsored Slot.
    * *Logic:* Only sends if `user.preferences.weekly_digest == True`.
3.  **Organizer Alerts:**
    * *Trigger:* Event Approved / Ticket Sales (Future).
    * *Content:* "Your event is live! Promote it now."

### B. User Control (GDPR Compliance)
Every email must have a one-click unsubscribe. We will track permissions granularly.

---

## 3. Database Schema Changes

### A. `FeaturedBooking` Model
Tracks the reservation of ad space.

```python
class FeaturedBooking(SQLModel, table=True):
    id: UUID
    event_id: UUID (Foreign Key)
    organizer_id: UUID (Foreign Key)
    
    slot_type: Enum (HERO_HOME, GLOBAL_PINNED, CATEGORY_PINNED, NEWSLETTER)
    target_id: Optional[str] # Null for Home, CategoryID for Category slots
    
    start_date: datetime
    end_date: datetime
    
    status: Enum (PENDING, ACTIVE, CANCELLED, REJECTED)
    amount_paid: int (in pence)
    stripe_session_id: str
B. UserPreferences Model
Tracks what we are allowed to send.

Python

class UserPreferences(SQLModel, table=True):
    user_id: UUID (Primary Key, Foreign Key)
    
    marketing_emails: bool = True     # General newsletter
    transactional_emails: bool = True # Receipts, Resets (Hard to opt-out)
    weekly_digest: bool = True        # The Automated Recs
    
    # Granular Interests (for smarter targeting)
    preferred_categories: List[str] = [] # e.g. ["music", "sport"]
4. Implementation Roadmap
Step 1: Foundation (No Stripe yet)
[ ] Scaffold FeaturedBooking and UserPreferences models.

[ ] Create app/services/email.py wrapper (Resend integration).

[ ] Create "Welcome Email" template and hook it into the Auth register flow.

Step 2: User Control
[ ] Create "Account > Notifications" page in Frontend.

[ ] Connect Frontend to UserPreferences API (Toggle switches).

Step 3: The "Manual" Ad System (Admin Only)
[ ] implement check_availability(slot, dates) logic in Backend.

[ ] Build "Featured" dashboard for Admins to manually assign slots to events (for testing/comping friends).

[ ] Update Frontend to actually render the featured events in the Hero/Lists.

Step 4: The Revenue Switch (Stripe)
[ ] Build the "Promote My Event" UI for Organizers (Date picker).

[ ] Integrate Stripe Checkout session creation.

[ ] Build Stripe Webhook to flip status from PENDING to ACTIVE.