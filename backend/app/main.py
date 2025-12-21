"""
Highland Events Hub API
Main application entry point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import SQLModel

from app.core.config import settings
from app.core.database import engine
from app.api import auth, events, venues, checkins, promotions, categories, tags, media, geocode, users, admin, hero, bookmarks, analytics, moderation, recommendations, collections, organizers, social, groups, search


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    from sqlmodel import Session, select
    from app.models.user import User
    
    # Startup: Create database tables
    SQLModel.metadata.create_all(engine)
    
    # One-time admin setup - CREATE admin user if not exists
    # Remove this code after first successful run!
    ADMIN_EMAIL = "cmack6189@gmail.com"
    ADMIN_PASSWORD = "AdminPass123!"  # Change this after first login!
    ADMIN_USERNAME = "cmack_admin"
    
    with Session(engine) as session:
        from app.core.security import hash_password
        
        # Check if admin user exists
        user = session.exec(select(User).where(User.email == ADMIN_EMAIL)).first()
        
        if not user:
            # Create new admin user
            user = User(
                email=ADMIN_EMAIL,
                username=ADMIN_USERNAME,
                display_name="Admin",
                password_hash=hash_password(ADMIN_PASSWORD),
                is_admin=True
            )
            session.add(user)
            session.commit()
            print(f"[STARTUP] Created admin user: {ADMIN_EMAIL}")
            print(f"[STARTUP] Password: {ADMIN_PASSWORD}")
            print(f"[STARTUP] IMPORTANT: Change password after first login!")
        elif not user.is_admin:
            user.is_admin = True
            session.add(user)
            session.commit()
            print(f"[STARTUP] Promoted {ADMIN_EMAIL} to admin")
        else:
            print(f"[STARTUP] Admin user {ADMIN_EMAIL} already exists")

    yield

    # Shutdown: cleanup if needed
    pass



app = FastAPI(
    title="Highland Events Hub API",
    description="Event discovery platform for the Scottish Highlands with gamification and location-based features",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - Uses ALLOWED_ORIGINS from environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Mount static files for uploads
app.mount("/static", StaticFiles(directory="static"), name="static")


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
app.include_router(checkins.router, prefix="/api/checkins", tags=["Check-ins"])
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
