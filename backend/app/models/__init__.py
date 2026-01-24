"""
Database models for Highland Events application.
All SQLModel table definitions are imported here for easy access.
"""
from .user import User
from .user_preferences import UserPreferences
from .venue import Venue
from .venue_category import VenueCategory
from .category import Category
from .tag import Tag, EventTag
from .event import Event
from .promotion import Promotion, DiscountType
from .payment import Payment, PaymentStatus
from .hero import HeroSlot
from .venue_claim import VenueClaim
from .collection import Collection
from .organizer import Organizer
from .follow import Follow
from .group_member import GroupMember
from .group_invite import GroupInvite
from .analytics import AnalyticsEvent
from .password_reset import PasswordResetToken
from .venue_staff import VenueStaff, VenueRole
from .venue_invite import VenueInvite
from .event_claim import EventClaim
from .user_category_follow import UserCategoryFollow
from .bookmark import Bookmark
from .report import Report
from .notification import Notification, NotificationType
from .featured_booking import FeaturedBooking, SlotType, BookingStatus, SLOT_CONFIG
from .slot_pricing import SlotPricing, DEFAULT_PRICING
from .showtime import EventShowtime

__all__ = [
    # User
    "User",
    "UserPreferences",
    # Venue
    "Venue",
    "VenueCategory",
    # Category
    "Category",
    "UserCategoryFollow",
    # Tag
    "Tag",
    "EventTag",
    # Event
    "Event",

    # Promotion
    "Promotion",
    "DiscountType",
    # Payment
    "Payment",
    "PaymentStatus",
    # Hero
    "HeroSlot",
    # Venue Claim
    "VenueClaim",
    # Collection
    "Collection",
    # Organizer
    "Organizer",
    # Social
    "Follow",
    "GroupMember",
    "GroupInvite",
    # Analytics
    "AnalyticsEvent",
    # Password Reset
    "PasswordResetToken",
    # Venue Staff
    "VenueStaff",
    "VenueRole",
    # Bookmarks
    "Bookmark",
    # Reports
    "Report",
    # Notifications
    "Notification",
    "NotificationType",
    # Featured Bookings
    "FeaturedBooking",
    "SlotType",
    "BookingStatus",
    "SLOT_CONFIG",
    # Slot Pricing
    "SlotPricing",
    "DEFAULT_PRICING",
    # Showtimes
    "EventShowtime",
    # Venue Invite
    "VenueInvite",
    # Event Claim
    "EventClaim",
]
