"""
Highland Events Hub API
Main application entry point.
"""
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import SQLModel

from app.core.config import settings
from app.core.database import engine, check_db_connection
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.limiter import limiter
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
    
    # Inline Migration: Add website_url and is_all_day to events table
    from sqlalchemy import text
    from app.core.database import get_session
    try:
        with next(get_session()) as session:
            # Add website_url column if it doesn't exist
            session.exec(text("""
                ALTER TABLE events ADD COLUMN IF NOT EXISTS website_url VARCHAR(500);
            """))
            # Add is_all_day column if it doesn't exist
            session.exec(text("""
                ALTER TABLE events ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT FALSE;
            """))
            # Triptych Hero Migration
            session.exec(text("""
                ALTER TABLE hero_slots ADD COLUMN IF NOT EXISTS image_override_left VARCHAR(500);
            """))
            session.exec(text("""
                ALTER TABLE hero_slots ADD COLUMN IF NOT EXISTS image_override_right VARCHAR(500);
            """))
            # Emergency Migration: Add is_dismissed to venues
            session.exec(text("""
                ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN DEFAULT FALSE;
            """))
            
            # Hero 4-Slot Magazine Migration
            session.exec(text("""
                ALTER TABLE hero_slots ADD COLUMN IF NOT EXISTS link VARCHAR(500);
            """))
            session.exec(text("""
                ALTER TABLE hero_slots ADD COLUMN IF NOT EXISTS badge_text VARCHAR(50);
            """))
            session.exec(text("""
                ALTER TABLE hero_slots ADD COLUMN IF NOT EXISTS badge_color VARCHAR(50) DEFAULT 'emerald';
            """))
            
            # Initialize 4 Fixed Slots (0-3)
            for i in range(4):
                # Check directly via SQL to avoid model mismatches during migration
                result = session.exec(text(f"SELECT id FROM hero_slots WHERE position = {i}")).first()
                if not result:
                    session.exec(text(f"""
                        INSERT INTO hero_slots (position, type, is_active, badge_color, overlay_style)
                        VALUES ({i}, 'spotlight_event', false, 'emerald', 'dark')
                    """))
                    logger.info(f"Initialized Hero Slot position {i}")

            session.commit()
            logger.info("Migration complete: Hero system updated (Fields added + Slots 0-3 initialized)")
            session.commit()
            logger.info("Migration complete: Added website_url and is_all_day columns to events table")
    except Exception as e:
        logger.warning(f"Migration skipped or failed (columns may already exist): {e}")
    
    # Database initialized
    logger.info("Application startup complete.")

    yield

    # Shutdown: cleanup if needed
    pass



app = FastAPI(
    title="Highland Events Hub API",
    description="Event discovery platform for the Scottish Highlands with location-based features",
    version="1.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

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
@app.get("/", tags=["Initial Load"])
async def root():
    """
    Serve the Single Page Application (SPA) entry point.
    Matches the root path regardless of query parameters (e.g., ?fbclid=...).
    """
    return FileResponse(os.path.join(static_dir, "index.html"))


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

