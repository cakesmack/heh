# Highland Events Hub - Implementation Plan

**Version:** 1.0
**Created:** 2025-12-07
**Status:** In Progress

---

## PHASE 1: Backend Foundation (Database, Models, Core Services)

### 1.1 Database & Configuration Setup
- **backend/app/core/config.py**: Database URL, JWT secrets, Mapbox API key, Stripe keys, CORS settings
- **backend/app/core/database.py**: SQLModel engine, session management, PostGIS extension setup
- **backend/app/core/security.py**: JWT token creation/validation, password hashing (bcrypt), get_current_user dependency

### 1.2 Database Models (SQLModel)
- **backend/app/models/user.py**: User model (id, email, password_hash, xp, level, created_at, is_admin, relationships)
- **backend/app/models/venue.py**: Venue model (id, name, address, latitude, longitude, geohash, category, region, owner_id)
- **backend/app/models/event.py**: Event model (id, title, description, date_start, date_end, venue_id, latitude, longitude, geohash, featured, featured_until, category, price)
- **backend/app/models/checkin.py**: CheckIn model (id, user_id, event_id, timestamp, xp_awarded, latitude, longitude)
- **backend/app/models/promotion.py**: Promotion model (id, venue_id, title, description, discount_type, discount_value, expires_at, requires_checkin)
- **backend/app/models/badge.py**: Badge model (id, name, description, icon, xp_threshold, badge_type) + UserBadge (user_id, badge_id, earned_at)
- **backend/app/models/xp_log.py**: XPLog model (id, user_id, action, xp_amount, timestamp, metadata)
- **backend/app/models/payment.py**: Payment model (id, user_id, event_id, stripe_payment_intent_id, amount, status, created_at)

### 1.3 Pydantic Schemas (Request/Response)
- **backend/app/schemas/user.py**: UserCreate, UserLogin, UserResponse, UserProfile, TokenResponse
- **backend/app/schemas/event.py**: EventCreate, EventUpdate, EventResponse, EventFilter, EventListResponse
- **backend/app/schemas/venue.py**: VenueCreate, VenueUpdate, VenueResponse, VenueFilter
- **backend/app/schemas/checkin.py**: CheckInRequest, CheckInResponse
- **backend/app/schemas/promotions.py**: PromotionCreate, PromotionResponse, PromotionUpdate
- **backend/app/schemas/gamification.py**: BadgeResponse, UserStatsResponse, LeaderboardEntry, XPLogResponse
- **backend/app/schemas/payments.py**: PaymentCreate, PaymentResponse, StripeWebhookEvent

---

## PHASE 2: Backend Services & Utilities

### 2.1 Core Services
- **backend/app/services/geolocation.py**:
  - Geocode addresses using geopy
  - Calculate geohash from coordinates
  - Haversine distance calculation
  - Validate coordinates are within Highlands region

- **backend/app/services/gamification.py**:
  - `award_xp(user_id, action, amount)` → creates XPLog, updates user XP, checks for level-up
  - `calculate_level(xp)` → returns level based on XP thresholds
  - `check_badge_eligibility(user_id)` → checks and awards new badges
  - Badge definitions (Local Guide, Venue Scout, Highland Hero, Night Owl, Highland Adventurer)

- **backend/app/services/promotions.py**:
  - `get_active_promotions(user_id, venue_id)` → returns promotions user is eligible for
  - `unlock_promotion(user_id, promotion_id)` → marks promotion as claimed

- **backend/app/services/payments.py** (Phase 2):
  - `create_checkout_session(event_id, user_id)` → Stripe Checkout session
  - `handle_webhook(event)` → process Stripe webhook, mark event as featured

### 2.2 Utilities
- **backend/app/utils/location_validation.py**:
  - `validate_checkin_location(event_lat, event_lon, user_lat, user_lon, max_distance=100)` → returns bool
  - `is_within_time_window(event_start, event_end, checkin_time, buffer_minutes=15)` → returns bool

- **backend/app/utils/validators.py**:
  - Email validation
  - Password strength validation
  - Coordinate range validation

---

## PHASE 3: Backend API Routes

### 3.1 Authentication Routes
- **backend/app/api/auth.py**:
  - `POST /auth/register` → create user account
  - `POST /auth/login` → return JWT access token
  - `GET /auth/me` → return current user profile with XP, level, badges

### 3.2 Events Routes
- **backend/app/api/events.py**:
  - `GET /events` → list events with filters (category, region, date, price, distance from coordinates)
  - `POST /events` → create event (authenticated organiser)
  - `GET /events/{id}` → get event details with venue info
  - `PUT /events/{id}` → update event (owner only)
  - `DELETE /events/{id}` → delete event (owner or admin)

### 3.3 Venues Routes
- **backend/app/api/venues.py**:
  - `GET /venues` → list venues with filters (category, region)
  - `POST /venues` → create venue
  - `GET /venues/{id}` → get venue details with upcoming events
  - `PUT /venues/{id}` → update venue (owner only)

### 3.4 Check-Ins Routes
- **backend/app/api/checkins.py**:
  - `POST /events/{id}/checkin` → validate location, time, award XP, unlock promotion
  - `GET /checkins/my` → get user's check-in history
  - `GET /events/{id}/checkins` → get check-in count for event

### 3.5 Gamification Routes
- **backend/app/api/gamification.py**:
  - `GET /gamification/profile` → user's XP, level, badges
  - `GET /gamification/badges` → all available badges + earned status
  - `GET /gamification/leaderboard` → top users by XP (Phase 2)
  - `GET /gamification/xp-logs` → user's XP history

### 3.6 Promotions Routes
- **backend/app/api/promotions.py**:
  - `GET /promotions/active` → active promotions near user
  - `POST /venues/{id}/promotions` → create promotion (venue owner)
  - `PUT /promotions/{id}` → update promotion
  - `DELETE /promotions/{id}` → delete promotion

### 3.7 Payments Routes (Phase 2)
- **backend/app/api/payments.py**:
  - `POST /payments/featured` → create Stripe Checkout session for featured listing
  - `POST /payments/webhook` → Stripe webhook handler
  - `GET /payments/my` → user's payment history

### 3.8 Update Main App
- **backend/app/main.py**: Include all routers, add CORS middleware, add startup event for database initialization

---

## PHASE 4: Frontend Foundation (Shared Types, API Client, Hooks)

### 4.1 Shared TypeScript Types
- **shared/types/user.ts**: User, UserProfile, TokenResponse
- **shared/types/event.ts**: Event, EventCreate, EventFilter
- **shared/types/venue.ts**: Venue, VenueCreate
- **shared/types/checkin.ts**: CheckIn, CheckInRequest, CheckInResponse
- **shared/types/promotions.ts**: Promotion, PromotionCreate
- **shared/types/payments.ts**: Payment, CheckoutSession
- **shared/types/gamification.ts**: Badge, UserStats, XPLog, LeaderboardEntry

### 4.2 Frontend API Client
- **frontend/src/lib/api.ts**:
  - Axios instance with base URL, auth token injection
  - API methods: `auth.login()`, `auth.register()`, `events.list()`, `events.get(id)`, `events.create()`, `venues.list()`, `checkins.create()`, `gamification.getProfile()`, etc.

### 4.3 Custom Hooks
- **frontend/src/hooks/useGeolocation.ts**: Get user's current location, watch position
- **frontend/src/hooks/useAuth.ts**: Auth state management (user, token, login, logout, register)
- **frontend/src/hooks/useEvents.ts**: Fetch and filter events
- **frontend/src/hooks/useVenues.ts**: Fetch venues
- **frontend/src/hooks/useCheckIn.ts**: Handle check-in flow with location validation

---

## PHASE 5: Frontend UI Components

### 5.1 Layout Components
- **frontend/src/components/layout/Header.tsx**: Logo, navigation links, user menu (login/logout)
- **frontend/src/components/layout/Footer.tsx**: Copyright, links
- **frontend/src/components/layout/BottomNavBar.tsx**: Mobile navigation (Home, Map, Explore, Profile)

### 5.2 Common Components
- **frontend/src/components/common/Button.tsx**: Reusable button with variants
- **frontend/src/components/common/Input.tsx**: Form input component
- **frontend/src/components/common/Card.tsx**: Generic card wrapper
- **frontend/src/components/common/Badge.tsx**: Display badge/tag
- **frontend/src/components/common/Spinner.tsx**: Loading spinner

### 5.3 Event Components
- **frontend/src/components/events/EventCard.tsx**: Event card with image, title, date, venue, distance, check-in button
- **frontend/src/components/events/EventFilters.tsx**: Filter sheet (category, date, price, distance)
- **frontend/src/components/events/EventList.tsx**: Grid/list of event cards
- **frontend/src/components/events/MapView.tsx**: Mapbox GL JS map with event markers, clustering, location button
- **frontend/src/components/events/CheckInButton.tsx**: Button to trigger check-in with location validation

### 5.4 Venue Components
- **frontend/src/components/venues/VenueCard.tsx**: Venue card with name, address, category, upcoming events count

### 5.5 Gamification Components
- **frontend/src/components/gamification/XPProgressBar.tsx**: Visual XP progress to next level
- **frontend/src/components/gamification/BadgeList.tsx**: Display earned/unearned badges
- **frontend/src/components/gamification/UserStats.tsx**: XP, level, badge count

### 5.6 Promotion Components
- **frontend/src/components/promotions/PromotionCard.tsx**: Display promotion with unlock status

---

## PHASE 6: Frontend Pages

### 6.1 Core Pages
- **frontend/src/pages/index.tsx**: Homepage with featured events, search bar, category filters
- **frontend/src/pages/events/index.tsx**: Events list/grid with filters, toggle to map view
- **frontend/src/pages/events/[id].tsx**: Event detail page with venue info, check-in button, promotions
- **frontend/src/pages/venues/index.tsx**: Venues directory
- **frontend/src/pages/venues/[id].tsx**: Venue detail page with upcoming events, promotions
- **frontend/src/pages/account/index.tsx**: User profile with XP, level, badges, check-in history

### 6.2 Additional Pages
- **frontend/src/pages/map/index.tsx**: Full-screen map view with floating event cards
- **frontend/src/pages/submit-event/page.tsx**: Event submission form (authenticated users)
- **frontend/src/pages/login.tsx**: Login form
- **frontend/src/pages/register.tsx**: Registration form
- **frontend/src/pages/admin/page.tsx**: Admin moderation panel (Phase 2)

### 6.3 App Configuration
- **frontend/src/app/layout.tsx**: Root layout with Header, BottomNavBar, auth provider
- **frontend/src/app/globals.css**: Tailwind CSS setup, custom theme colors

---

## PHASE 7: Map & Geolocation Integration

### 7.1 Mapbox Setup
- **frontend/package.json**: Add `mapbox-gl`, `@types/mapbox-gl`
- **frontend/src/lib/mapbox.ts**: Mapbox configuration, custom marker styles

### 7.2 Map Components
- **frontend/src/components/events/MapView.tsx**:
  - Initialize Mapbox GL JS map centered on Inverness
  - Display event markers with clustering
  - "Locate me" button to center on user location
  - Click marker → show event card in slide-up sheet
  - Toggle between map and list views

### 7.3 Check-In Flow
- Request user location permission
- Validate distance from event venue (<100m)
- Validate time window (during event or ±15 min)
- Submit check-in to backend
- Show XP award animation + promotion unlock

---

## PHASE 8: Database Seeds & Testing Data

### 8.1 Seed Data
- **backend/seeds/seed_data.py**:
  - Create sample users (admin, regular users)
  - Create venues across Highlands (Inverness, Fort William, Ullapool, Portree, etc.)
  - Create events (music, festivals, distillery tours, community events)
  - Create promotions (discounts at venues)
  - Create badge definitions

### 8.2 Migration Script
- **backend/seeds/init_db.py**: Create all tables, run PostGIS extension, seed initial data

---

## PHASE 9: Payments Integration (Phase 2)

### 9.1 Stripe Setup
- **backend/app/services/payments.py**: Create checkout session, handle webhooks
- **backend/app/api/payments.py**: Payment endpoints
- **frontend/src/components/payments/CheckoutButton.tsx**: Trigger Stripe Checkout

### 9.2 Featured Listings
- Update event model to handle `featured` flag and expiry
- Show featured events at top of listings
- Visual badge for featured events

---

## PHASE 10: Validation & Testing

### 10.1 Backend Validation
- Run FastAPI server: `uvicorn app.main:app --reload`
- Test all endpoints with Postman/Thunder Client
- Verify database schema with PostGIS queries
- Test check-in validation logic
- Test gamification XP awards and level-ups

### 10.2 Frontend Validation
- Run Next.js dev server: `npm run dev`
- Test authentication flow
- Test event listing and filtering
- Test map view and marker interactions
- Test check-in flow with location mocking
- Verify TypeScript types match backend schemas

### 10.3 Integration Testing
- End-to-end: Register → Login → Browse events → Check in → Earn XP → View profile
- Test promotion unlock flow
- Test event submission flow
- Test admin moderation

---

## PHASE 11: Documentation & Deployment Prep

### 11.1 Documentation
- **backend/README.md**: Setup instructions, API documentation, environment variables
- **frontend/README.md**: Setup instructions, component documentation
- **shared/README.md**: Type definitions overview

### 11.2 Environment Configuration
- **backend/.env.example**: All required environment variables
- **frontend/.env.local.example**: API URL, Mapbox token
- **infrastructure/docker-compose.yml**: PostgreSQL with PostGIS, backend, frontend services
- **infrastructure/Dockerfile.backend**: Python FastAPI container
- **infrastructure/Dockerfile.frontend**: Next.js container

### 11.3 Deployment
- Set up Neon/Supabase PostgreSQL with PostGIS
- Deploy backend to Render/Railway
- Deploy frontend to Vercel
- Configure Stripe webhooks
- Set up Mapbox account and tokens

---

## Implementation Order Summary

1. **Backend Foundation** (Phase 1-3): Models → Schemas → Services → API Routes
2. **Frontend Foundation** (Phase 4): Shared types → API client → Hooks
3. **UI Components** (Phase 5): Layout → Common → Event/Venue/Gamification components
4. **Pages** (Phase 6): Core pages → Additional pages
5. **Map Integration** (Phase 7): Mapbox setup → Map components → Check-in flow
6. **Seeds** (Phase 8): Test data for development
7. **Payments** (Phase 9): Stripe integration (optional, Phase 2)
8. **Validation** (Phase 10): End-to-end testing
9. **Documentation** (Phase 11): READMEs, deployment setup

---

## Key Technical Notes

- **Database**: PostgreSQL with PostGIS extension for geospatial queries
- **Geohashing**: Used for efficient spatial indexing
- **JWT Authentication**: Tokens with 7-day expiry
- **Password Hashing**: bcrypt with salt rounds
- **Distance Calculation**: Haversine formula for check-in validation
- **Mapbox**: GL JS v3 for interactive maps
- **Mobile-First**: Tailwind CSS with responsive breakpoints
- **PWA Features**: Service worker, manifest.json (Phase 2)
