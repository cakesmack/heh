"""
Background job to expire and complete featured bookings.

Functions:
1. Expire PENDING_PAYMENT bookings older than 15 minutes
2. Complete ACTIVE bookings where end_date < today

Usage: cd backend && python -m app.scripts.expire_featured

Schedule: Run every 5 minutes via cron/scheduler
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta, date

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlmodel import Session, select, and_
from app.core.database import engine
from app.models.featured_booking import FeaturedBooking, BookingStatus


def expire_pending_payments():
    """Cancel bookings with PENDING_PAYMENT status older than 15 minutes."""
    cutoff_time = datetime.utcnow() - timedelta(minutes=15)

    with Session(engine) as session:
        expired_bookings = session.exec(
            select(FeaturedBooking).where(
                and_(
                    FeaturedBooking.status == BookingStatus.PENDING_PAYMENT,
                    FeaturedBooking.created_at < cutoff_time
                )
            )
        ).all()

        if not expired_bookings:
            print("No pending payment bookings to expire")
            return 0

        print(f"Found {len(expired_bookings)} expired pending payments")

        for booking in expired_bookings:
            booking.status = BookingStatus.CANCELLED
            booking.updated_at = datetime.utcnow()
            session.add(booking)

        session.commit()
        print(f"Expired {len(expired_bookings)} bookings")
        return len(expired_bookings)


def complete_ended_bookings():
    """Mark ACTIVE bookings as COMPLETED when their end_date has passed."""
    from app.models.event import Event
    
    today = date.today()

    with Session(engine) as session:
        ended_bookings = session.exec(
            select(FeaturedBooking).where(
                and_(
                    FeaturedBooking.status == BookingStatus.ACTIVE,
                    FeaturedBooking.end_date < today
                )
            )
        ).all()

        if not ended_bookings:
            print("No active bookings to complete")
            return 0

        print(f"Found {len(ended_bookings)} ended active bookings")

        for booking in ended_bookings:
            booking.status = BookingStatus.COMPLETED
            booking.updated_at = datetime.utcnow()
            session.add(booking)
            
            # Check if event has any OTHER active bookings remaining
            other_active = session.exec(
                select(FeaturedBooking).where(
                    and_(
                        FeaturedBooking.event_id == booking.event_id,
                        FeaturedBooking.status == BookingStatus.ACTIVE,
                        FeaturedBooking.id != booking.id
                    )
                )
            ).first()
            
            if not other_active:
                # No other active bookings - reset event featured status
                event = session.get(Event, booking.event_id)
                if event:
                    event.featured = False
                    event.featured_until = None
                    session.add(event)
                    print(f"  Reset event {booking.event_id} featured = False")

        session.commit()
        print(f"Completed {len(ended_bookings)} bookings")
        return len(ended_bookings)


def run_all():
    """Run all expiry tasks."""
    print(f"Running featured booking expiry at {datetime.utcnow()}")
    print("-" * 40)

    expired = expire_pending_payments()
    completed = complete_ended_bookings()

    print("-" * 40)
    print(f"Summary: {expired} expired, {completed} completed")


if __name__ == "__main__":
    run_all()
