"""
Pydantic schemas for API request/response validation.
All schema classes are imported here for easy access.
"""
# User schemas
from .user import (
    UserCreate,
    UserLogin,
    UserUpdate,
    UserResponse,
    UserProfile,
    TokenResponse,
)

# Event schemas
from .event import (
    EventCreate,
    EventUpdate,
    EventResponse,
    EventFilter,
    EventListResponse,
)

# Venue schemas
from .venue import (
    VenueCreate,
    VenueUpdate,
    VenueResponse,
    VenueFilter,
    VenueListResponse,
)

# Check-in schemas
from .checkin import (
    CheckInRequest,
    CheckInResponse,
    CheckInHistory,
    CheckInStatsResponse,
)

# Promotion schemas
from .promotions import (
    PromotionCreate,
    PromotionUpdate,
    PromotionResponse,
    PromotionListResponse,
)


# Payment schemas
from .payments import (
    PaymentCreate,
    PaymentResponse,
    CheckoutSessionResponse,
    StripeWebhookEvent,
    PaymentListResponse,
)

__all__ = [
    # User
    "UserCreate",
    "UserLogin",
    "UserUpdate",
    "UserResponse",
    "UserProfile",
    "TokenResponse",
    # Event
    "EventCreate",
    "EventUpdate",
    "EventResponse",
    "EventFilter",
    "EventListResponse",
    # Venue
    "VenueCreate",
    "VenueUpdate",
    "VenueResponse",
    "VenueFilter",
    "VenueListResponse",
    # Check-in
    "CheckInRequest",
    "CheckInResponse",
    "CheckInHistory",
    "CheckInStatsResponse",
    # Promotion
    "PromotionCreate",
    "PromotionUpdate",
    "PromotionResponse",
    "PromotionListResponse",
    # Payment
    "PaymentCreate",
    "PaymentResponse",
    "CheckoutSessionResponse",
    "StripeWebhookEvent",
    "PaymentListResponse",
]
