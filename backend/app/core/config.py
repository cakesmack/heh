"""
Application configuration settings.
Loads environment variables and provides application-wide configuration.
"""
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

    # Database - No default! Must be set in environment.
    # Local dev: sqlite:///./highland_events.db
    # Production: postgresql://... (via Render)
    DATABASE_URL: str
    DATABASE_URL_POOLER: Optional[str] = None  # For Render pooled connections

    # Security - SECRET_KEY must be set in production
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # CORS - controlled via environment variable
    ALLOWED_ORIGINS: list[str] = []

    @field_validator('ALLOWED_ORIGINS', mode='before')
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, list]) -> list:
        """Parse ALLOWED_ORIGINS from string or list.

        Accepts:
        - JSON array: '["https://example.com", "https://app.example.com"]'
        - Comma-separated: 'https://example.com, https://app.example.com'
        - Python list: ['https://example.com']
        """
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            # Try JSON array first
            if v.startswith("["):
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(origin).strip() for origin in parsed]
                except json.JSONDecodeError:
                    pass  # Fall through to comma-separated
            # Comma-separated format
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        raise ValueError(f"Invalid ALLOWED_ORIGINS format: {v}")

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

    # Resend (Marketing Emails)
    RESEND_API_KEY: Optional[str] = None

    # Email (Gmail SMTP for password reset)
    SMTP_USER: Optional[str] = None
    SMTP_PASS: Optional[str] = None
    FRONTEND_URL: str = "http://localhost:3000"
    PASSWORD_RESET_EXPIRE_MINUTES: int = 60
    ADMIN_EMAIL: Optional[str] = None

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

