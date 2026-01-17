"""
Highland Events Hub API
Main application entry point.
"""
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import SQLModel

from app.core.config import settings
from app.core.database import engine, check_db_connection
from app.api import auth, events, venues, promotions, categories, tags, media, geocode, users, admin, hero, bookmarks, analytics, moderation, recommendations, collections, organizers, social, groups, search, preferences, featured, notifications, email_testing, cron, admin_import

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup: Verify database connection with retry
    try:
        logger.info("Checking database connection...")
        check_db_connection()
        logger.info("Database connection successful")
    except Exception as e:
        logger.error(f"Database connection failed after retries: {e}")
        # Continue startup - individual requests will fail gracefully

    # Create database tables
    # Import all models explicitly to ensure they're registered with SQLModel metadata
    from app.models import VenueInvite, EventClaim  # New ownership/claiming tables
    SQLModel.metadata.create_all(engine)
    logger.info("Database tables created/verified (including venue_invites, event_claims)")
    
    # Run pending migrations (add missing columns to existing tables)
    try:
        from sqlalchemy import text
        from app.core.database import get_session
        with engine.connect() as conn:
            # Add venue contact and social media fields if they don't exist
            conn.execute(text("""
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='email') THEN
                        ALTER TABLE venues ADD COLUMN email VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='opening_hours') THEN
                        ALTER TABLE venues ADD COLUMN opening_hours VARCHAR(500);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='social_facebook') THEN
                        ALTER TABLE venues ADD COLUMN social_facebook VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='social_instagram') THEN
                        ALTER TABLE venues ADD COLUMN social_instagram VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='social_x') THEN
                        ALTER TABLE venues ADD COLUMN social_x VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='social_linkedin') THEN
                        ALTER TABLE venues ADD COLUMN social_linkedin VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='social_tiktok') THEN
                        ALTER TABLE venues ADD COLUMN social_tiktok VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='website_url') THEN
                        ALTER TABLE venues ADD COLUMN website_url VARCHAR(255);
                    END IF;
                    -- Add moderation_reason to events table
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='moderation_reason') THEN
                        ALTER TABLE events ADD COLUMN moderation_reason VARCHAR(255);
                    END IF;
                    
                    -- Add MAGAZINE_CAROUSEL to slottype enum if it doesn't exist
                    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MAGAZINE_CAROUSEL' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'slottype')) THEN
                        ALTER TYPE slottype ADD VALUE IF NOT EXISTS 'MAGAZINE_CAROUSEL';
                    END IF;
                    
                    -- Organizer profile enhancements (Part 2 upgrade)
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizers' AND column_name='cover_image_url') THEN
                        ALTER TABLE organizers ADD COLUMN cover_image_url VARCHAR(500);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizers' AND column_name='city') THEN
                        ALTER TABLE organizers ADD COLUMN city VARCHAR(100);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizers' AND column_name='social_facebook') THEN
                        ALTER TABLE organizers ADD COLUMN social_facebook VARCHAR(500);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizers' AND column_name='social_instagram') THEN
                        ALTER TABLE organizers ADD COLUMN social_instagram VARCHAR(500);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizers' AND column_name='social_website') THEN
                        ALTER TABLE organizers ADD COLUMN social_website VARCHAR(500);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizers' AND column_name='public_email') THEN
                        ALTER TABLE organizers ADD COLUMN public_email VARCHAR(255);
                    END IF;
                    
                    -- Personalization Engine: notification preferences for users
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='receive_interest_notifications') THEN
                        ALTER TABLE users ADD COLUMN receive_interest_notifications BOOLEAN DEFAULT TRUE;
                    END IF;
                    
                    -- Recurring Event Group ID for linking recurring series
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='recurrence_group_id') THEN
                        ALTER TABLE events ADD COLUMN recurrence_group_id VARCHAR(255);
                        CREATE INDEX IF NOT EXISTS ix_events_recurrence_group_id ON events(recurrence_group_id);
                    END IF;
                END $$;
            """))
            conn.commit()
            logger.info("Migrations applied successfully")
    except Exception as e:
        logger.warning(f"Migration check failed (may be SQLite): {e}")

    yield

    # Shutdown: cleanup if needed
    pass



app = FastAPI(
    title="Highland Events Hub API",
    description="Event discovery platform for the Scottish Highlands with location-based features",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - MUST be added first to handle preflight requests
app.add_middleware(
    CORSMiddleware,
    # Combine settings.ALLOWED_ORIGINS with explicitly required production domains
    allow_origins=settings.ALLOWED_ORIGINS + ["https://www.highlandeventshub.co.uk", "https://highlandeventshub.co.uk"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler to catch unhandled errors.
    Ensures proper JSON response with CORS headers (via middleware).
    Prevents 500 errors from appearing as CORS errors in the browser.
    """
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    # Don't expose internal errors in production
    detail = str(exc) if settings.DEBUG else "Internal server error"

    return JSONResponse(
        status_code=500,
        content={
            "detail": detail,
            "type": "internal_error",
        }
    )


# Mount static files for uploads (create directory if it doesn't exist)
static_dir = "static"
if not os.path.exists(static_dir):
    os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


# Root endpoint
@app.get("/", tags=["Health"])
def root():
    """
    Health check endpoint.
    """
    return {
        "message": "Highland Events Hub API",
        "status": "running",
        "version": "1.0.0"
    }


# Include all routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(events.router, prefix="/api/events", tags=["Events"])
app.include_router(venues.router, prefix="/api/venues", tags=["Venues"])

app.include_router(promotions.router, prefix="/api/promotions", tags=["Promotions"])
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(tags.router, prefix="/api/tags", tags=["Tags"])
app.include_router(media.router, prefix="/api/media", tags=["Media"])
app.include_router(geocode.router, prefix="/api/geocode", tags=["Geocoding"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(hero.router, prefix="/api/hero", tags=["Hero"])
app.include_router(bookmarks.router, prefix="/api/bookmarks", tags=["Bookmarks"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(moderation.router, prefix="/api/moderation", tags=["Moderation"])
app.include_router(recommendations.router, prefix="/api/recommendations", tags=["Recommendations"])
app.include_router(collections.router, prefix="/api/collections", tags=["Collections"])
app.include_router(organizers.router, prefix="/api/organizers", tags=["Organizers"])
app.include_router(social.router, prefix="/api/social", tags=["Social"])
app.include_router(groups.router, prefix="/api/groups", tags=["Groups"])
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(preferences.router, prefix="/api")
app.include_router(featured.router, prefix="/api/featured", tags=["Featured"])
app.include_router(notifications.router)
app.include_router(email_testing.router, prefix="/api/admin/email-testing", tags=["Admin Email Testing"])
app.include_router(admin_import.router, prefix="/api/admin", tags=["Admin Import"])
app.include_router(cron.router, prefix="/api")

