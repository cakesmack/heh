# Highland Ads System Design

**Status:** Approved
**Date:** 2025-12-28
**Branch:** phase-3

## Overview

Inventory-based advertising system allowing event organizers to pay for premium placement. Slots are limited and sold on a first-come, first-served basis for specific date ranges.

## Decisions Made

| Topic | Decision |
|-------|----------|
| Scope | Full system with Stripe (manual admin + self-service) |
| Stripe | Needs setup from scratch |
| Hero behaviour | Paid slots replace manual; manual is fallback when no paid |
| Payment model | Pay upfront for date range via Stripe Checkout |
| Approval | Auto-approve trusted organizers, review new ones |

---

## 1. Database Schema

### FeaturedBooking Model

```python
class SlotType(str, Enum):
    HERO_HOME = "hero_home"              # Homepage carousel (max 5)
    GLOBAL_PINNED = "global_pinned"      # Top of "All Events" list (max 3)
    CATEGORY_PINNED = "category_pinned"  # Top of category page (max 3 per category)
    NEWSLETTER = "newsletter"            # Weekly digest (max 2 per send)

class BookingStatus(str, Enum):
    PENDING_PAYMENT = "pending_payment"    # Held 15 mins awaiting payment
    PENDING_APPROVAL = "pending_approval"  # Paid, awaiting admin review (new organizers)
    ACTIVE = "active"                      # Live and displaying
    COMPLETED = "completed"                # Date range passed
    CANCELLED = "cancelled"                # Refunded or expired
    REJECTED = "rejected"                  # Admin rejected

class FeaturedBooking(SQLModel, table=True):
    __tablename__ = "featured_bookings"

    id: str (PK)
    event_id: str (FK -> events)
    organizer_id: str (FK -> users)

    slot_type: SlotType
    target_id: Optional[str]  # Category ID for CATEGORY_PINNED, null otherwise

    start_date: date
    end_date: date

    status: BookingStatus
    amount_paid: int  # In pence

    stripe_checkout_session_id: Optional[str]
    stripe_payment_intent_id: Optional[str]

    created_at: datetime
    updated_at: datetime
```

### User Model Addition

```python
# Add to User model
is_trusted_organizer: bool = Field(default=False)
```

### Slot Limits (Config)

| Slot Type | Max Concurrent |
|-----------|----------------|
| HERO_HOME | 5 |
| GLOBAL_PINNED | 3 |
| CATEGORY_PINNED | 3 per category |
| NEWSLETTER | 2 per weekly send |

---

## 2. Availability & Pricing Logic

### Availability Check

When organizer selects dates for a slot:
1. Query `FeaturedBooking` where `slot_type` matches AND `status` IN (PENDING_PAYMENT, PENDING_APPROVAL, ACTIVE)
2. For each date in requested range, count overlapping bookings
3. If any date exceeds max slots → that date is unavailable

```python
def check_availability(slot_type: SlotType, start: date, end: date, target_id: str = None) -> dict:
    """
    Returns: {
        "available": bool,
        "unavailable_dates": [date, ...],
        "slots_remaining": {date: int, ...}
    }
    """
```

### Pricing

| Slot | Price/Day | Min Days |
|------|-----------|----------|
| HERO_HOME | £40 (4000 pence) | 3 |
| GLOBAL_PINNED | £20 (2000 pence) | 3 |
| CATEGORY_PINNED | £10 (1000 pence) | 3 |
| NEWSLETTER | £15 (1500 pence, flat) | N/A |

### 15-Minute Hold

When organizer starts checkout:
1. Create `FeaturedBooking` with status=PENDING_PAYMENT
2. Start Stripe Checkout session
3. If payment not completed in 15 mins → background job expires the booking

### Trust System

- New organizers: payment → PENDING_APPROVAL → admin approves → ACTIVE
- Trusted organizers: payment → ACTIVE (instant)
- Admin sets `is_trusted_organizer = True` after first successful booking

---

## 3. Stripe Integration

### Checkout Flow

```
1. Organizer selects: Event → Slot Type → Date Range
2. Frontend calls: POST /api/featured/check-availability
3. If available, frontend calls: POST /api/featured/create-checkout
   → Backend creates FeaturedBooking (PENDING_PAYMENT)
   → Backend creates Stripe Checkout Session
   → Returns checkout URL
4. Organizer redirected to Stripe Checkout
5. On success: Stripe sends webhook → Backend updates status
6. On cancel/expire: Background job cleans up after 15 mins
```

### Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | If trusted: status → ACTIVE. If new: status → PENDING_APPROVAL |
| `checkout.session.expired` | status → CANCELLED, release slot |

### API Endpoints

**Public (Authenticated):**
```
POST /api/featured/check-availability
  Body: {slot_type, start_date, end_date, target_id?}
  Returns: {available, unavailable_dates, price_quote, slots_remaining}

POST /api/featured/create-checkout
  Body: {event_id, slot_type, start_date, end_date, target_id?}
  Returns: {checkout_url, booking_id}

GET /api/featured/my-bookings
  Returns: List of organizer's featured bookings
```

**Webhook:**
```
POST /api/featured/webhook
  Stripe signature verified
  Handles: checkout.session.completed, checkout.session.expired
```

**Admin:**
```
GET /api/admin/featured
  Query: ?status=pending_approval&slot_type=hero_home
  Returns: All bookings with filters

PATCH /api/admin/featured/{id}/approve
  PENDING_APPROVAL → ACTIVE

PATCH /api/admin/featured/{id}/reject
  PENDING_APPROVAL → REJECTED (triggers refund)
```

**Display:**
```
GET /api/featured/active
  Query: ?slot_type=hero_home&target_id=xxx
  Returns: Currently active featured events for display
```

---

## 4. Frontend Changes

### Homepage Hero

```tsx
// Logic change in hero component:
1. Fetch: GET /api/featured/active?slot_type=hero_home
2. If results exist → display those events in carousel
3. If empty → fall back to manual hero slides (existing behaviour)
```

### Event Lists (Pinned Slots)

```tsx
// On homepage "All Events" and category pages:
1. Fetch: GET /api/featured/active?slot_type=global_pinned (or category_pinned&target_id=xxx)
2. Render pinned events at top with subtle "Featured" badge
3. Then render regular events below
```

### Organizer "Promote Event" UI

New page: `/events/[id]/promote`

```
┌─────────────────────────────────────────────────────┐
│  Promote: "Highland Music Festival"                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  SELECT PLACEMENT                                   │
│  ○ Hero Carousel (£40/day) - Maximum visibility     │
│  ○ Homepage Pinned (£20/day) - Top of all events    │
│  ○ Category Pinned (£10/day) - Top of Music events  │
│                                                     │
│  SELECT DATES                                       │
│  [Calendar with unavailable dates greyed out]       │
│  Start: [Dec 30] → End: [Jan 3]                    │
│                                                     │
│  ─────────────────────────────────────────────────  │
│  5 days × £40/day = £200                           │
│                                                     │
│  [Proceed to Payment →]                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Admin Featured Dashboard

Extend `/admin/featured`:
- List all bookings with status filters
- Approve/Reject buttons for PENDING_APPROVAL
- Revenue stats summary

---

## 5. Background Jobs

| Job | Schedule | Action |
|-----|----------|--------|
| Expire pending payments | Every 5 mins | PENDING_PAYMENT older than 15 mins → CANCELLED |
| Complete bookings | Daily 00:01 | ACTIVE where end_date < today → COMPLETED |

---

## 6. Edge Cases

| Scenario | Handling |
|----------|----------|
| Event deleted while featured | Keep booking, show "Event Removed" in admin, no auto-refund |
| Event date changes | Featured booking stays on its dates (not tied to event date) |
| Refund request | Admin-only manual refund via Stripe dashboard, mark CANCELLED |
| Race condition | Database transaction + unique constraint prevents double-booking |

### Rejection Flow

When admin rejects PENDING_APPROVAL:
1. Call Stripe API to refund payment
2. Set status → REJECTED
3. Send email to organizer

---

## 7. Stripe Setup Checklist

1. Create Stripe account at stripe.com
2. Get API keys (Dashboard → Developers → API Keys)
3. Add to .env:
   ```
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```
4. Create webhook endpoint in Stripe Dashboard pointing to `/api/featured/webhook`
5. Select events: `checkout.session.completed`, `checkout.session.expired`

---

## Implementation Order

1. **Stripe Setup** - Account, keys, webhook endpoint
2. **FeaturedBooking Model** - Schema + migration
3. **User trusted flag** - Add `is_trusted_organizer` to User model
4. **Availability Service** - Check/calculate availability and pricing
5. **Featured API** - Checkout, webhook, my-bookings endpoints
6. **Admin API** - List, approve, reject endpoints
7. **Display API** - Active featured events for frontend
8. **Frontend: Promote Page** - Slot selection, date picker, checkout
9. **Frontend: Hero Integration** - Paid slots replace manual
10. **Frontend: Pinned Events** - Featured badge on lists
11. **Admin Dashboard** - Featured bookings management
12. **Background Jobs** - Expiry and completion scripts
