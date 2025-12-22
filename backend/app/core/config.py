"""
Application configuration settings.
Loads environment variables and provides application-wide configuration.
"""
import os
import json
from typing import Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "Highland Events API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite:///./highland_events.db"
    DATABASE_URL_POOLER: Optional[str] = None  # For Render pooled connections

    # Security - SECRET_KEY must be set in production
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # CORS - Add your production URLs here
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]

    @field_validator('ALLOWED_ORIGINS', mode='before')
    @classmethod
    def parse_allowed_origins(cls, v: Union[str, list]) -> list:
        """Parse ALLOWED_ORIGINS from JSON string or list."""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                # If not valid JSON, treat as comma-separated
                return [origin.strip() for origin in v.split(',')]
        return v

    @field_validator('DATABASE_URL', 'DATABASE_URL_POOLER', mode='before')
    @classmethod
    def fix_postgres_scheme(cls, v: Optional[str]) -> Optional[str]:
        """Fix postgres:// scheme for SQLAlchemy compatibility."""
        if v and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    # External Services
    MAPBOX_API_KEY: Optional[str] = None
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_PUBLISHABLE_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    # UK Postcode Geocoding
    IDEAL_POSTCODES_API_KEY: Optional[str] = None
    GOOGLE_GEOCODE_API_KEY: Optional[str] = None
    OS_API_KEY: Optional[str] = None

    # Email (Gmail SMTP for password reset)
    SMTP_USER: Optional[str] = None
    SMTP_PASS: Optional[str] = None
    FRONTEND_URL: str = "http://localhost:3000"
    PASSWORD_RESET_EXPIRE_MINUTES: int = 60

    # Media Upload
    UPLOAD_DIR: str = "static/uploads"

    # Check-in Settings
    CHECKIN_MAX_DISTANCE_METERS: int = 100
    CHECKIN_TIME_BUFFER_MINUTES: int = 15

    # Highlands Geographic Boundaries (approximate)
    HIGHLANDS_LAT_MIN: float = 56.0
    HIGHLANDS_LAT_MAX: float = 59.0
    HIGHLANDS_LON_MIN: float = -7.0
    HIGHLANDS_LON_MAX: float = -3.0

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


# Global settings instance
settings = Settings()

