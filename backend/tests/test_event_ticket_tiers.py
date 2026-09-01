import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool

from app.models.user import User
from app.models.event import Event
from app.models.venue import Venue
from app.models.category import Category
from app.models.ticket_tier import TicketTier
from app.models.organizer import Organizer
from app.schemas.event import EventCreate, EventUpdate
from app.schemas.ticketing import TicketTierCreate


from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_create_and_update_event_ticket_tiers(session: Session):
    # Setup test category and organizer user
    user_id = str(uuid4()).replace("-", "")
    user = User(
        id=user_id,
        email="organizer@example.com",
        username="organizer",
        seller_tier=2,
        seller_status="approved",
    )
    session.add(user)

    category = Category(id="cat1", name="Music", slug="music")
    session.add(category)
    session.commit()

    # 1. Test Ticket Tier creation with an event
    event_id = str(uuid4()).replace("-", "")
    event = Event(
        id=event_id,
        title="Highland Rock Festival",
        description="Epic outdoor rock festival",
        date_start=datetime.utcnow() + timedelta(days=30),
        date_end=datetime.utcnow() + timedelta(days=31),
        location_name="Inverness Castle",
        category_id="cat1",
        organizer_id=user_id,
        is_ticketing_enabled=True,
    )
    session.add(event)
    session.flush()

    # Add ticket tiers as done in create_event
    event_create_data = EventCreate(
        title="Highland Rock Festival",
        date_start=datetime.utcnow() + timedelta(days=30),
        date_end=datetime.utcnow() + timedelta(days=31),
        location_name="Inverness Castle",
        category_id="cat1",
        is_ticketing_enabled=True,
        ticket_tiers=[
            TicketTierCreate(
                name="Early Bird",
                price=15.0,
                quantity_available=50,
                max_per_order=4,
            ),
            TicketTierCreate(
                name="General Admission",
                price=25.0,
                quantity_available=200,
                max_per_order=6,
            ),
        ],
    )

    for tier_data in event_create_data.ticket_tiers:
        tier_dict = tier_data.model_dump()
        new_tier = TicketTier(
            event_id=event.id,
            name=tier_dict.get("name", ""),
            price=float(tier_dict.get("price", 0.0) or 0.0),
            quantity_available=int(tier_dict.get("quantity_available", 0) or 0),
            max_per_order=int(tier_dict.get("max_per_order", 6) or 6),
        )
        session.add(new_tier)

    session.commit()
    session.refresh(event)

    # Verify tiers in DB
    tiers = session.exec(select(TicketTier).where(TicketTier.event_id == event.id)).all()
    assert len(tiers) == 2
    tier_names = {t.name for t in tiers}
    assert "Early Bird" in tier_names
    assert "General Admission" in tier_names

    early_bird = next(t for t in tiers if t.name == "Early Bird")
    assert early_bird.price == 15.0
    assert early_bird.quantity_available == 50

    # 2. Test PUT / update_event logic with ticket_tiers array (simulating request payload)
    # Update Early Bird price, remove General Admission, add VIP
    update_payload = EventUpdate(
        title="Highland Rock Festival - Updated",
        is_ticketing_enabled=True,
        ticket_tiers=[
            TicketTierCreate(
                id=early_bird.id,
                name="Early Bird Discount",
                price=18.0,
                quantity_available=45,
                max_per_order=4,
            ),
            TicketTierCreate(
                name="VIP Pass",
                price=50.0,
                quantity_available=30,
                max_per_order=2,
            ),
        ],
    )

    # Simulate update logic in events.py
    existing_tiers = session.exec(
        select(TicketTier).where(TicketTier.event_id == event.id)
    ).all()
    existing_tiers_map = {t.id: t for t in existing_tiers}
    retained_tier_ids = set()

    for tier_data in update_payload.ticket_tiers:
        tier_dict = tier_data.model_dump()
        tier_id = tier_dict.get("id")
        tier_name = tier_dict.get("name")

        matched_tier = None
        if tier_id and tier_id in existing_tiers_map:
            matched_tier = existing_tiers_map[tier_id]
        elif not tier_id and tier_name:
            for et in existing_tiers:
                if et.id not in retained_tier_ids and et.name == tier_name:
                    matched_tier = et
                    break

        if matched_tier:
            if "name" in tier_dict and tier_dict["name"] is not None:
                matched_tier.name = tier_dict["name"]
            if "price" in tier_dict and tier_dict["price"] is not None:
                matched_tier.price = float(tier_dict["price"])
            if "quantity_available" in tier_dict and tier_dict["quantity_available"] is not None:
                matched_tier.quantity_available = int(tier_dict["quantity_available"])
            if "max_per_order" in tier_dict and tier_dict["max_per_order"] is not None:
                matched_tier.max_per_order = int(tier_dict["max_per_order"])
            matched_tier.updated_at = datetime.utcnow()
            session.add(matched_tier)
            retained_tier_ids.add(matched_tier.id)
        else:
            new_tier = TicketTier(
                event_id=event.id,
                name=tier_dict.get("name", ""),
                price=float(tier_dict.get("price", 0.0) or 0.0),
                quantity_available=int(tier_dict.get("quantity_available", 0) or 0),
                max_per_order=int(tier_dict.get("max_per_order", 6) or 6),
            )
            session.add(new_tier)

    for old_tier_id, old_tier in existing_tiers_map.items():
        if old_tier_id not in retained_tier_ids:
            if old_tier.quantity_sold == 0:
                session.delete(old_tier)
            else:
                old_tier.is_hidden = True
                session.add(old_tier)

    session.commit()
    session.refresh(event)

    # Verify updated tiers
    updated_tiers = session.exec(select(TicketTier).where(TicketTier.event_id == event.id)).all()
    assert len(updated_tiers) == 2
    updated_names = {t.name for t in updated_tiers}
    assert "Early Bird Discount" in updated_names
    assert "VIP Pass" in updated_names
    assert "General Admission" not in updated_names

    updated_eb = next(t for t in updated_tiers if t.name == "Early Bird Discount")
    assert updated_eb.id == early_bird.id
    assert updated_eb.price == 18.0
    assert updated_eb.quantity_available == 45

    # 3. Test build_event_response includes ticket_tiers for public page
    from app.api.events import build_event_response
    from app.utils.price_age_parser import parse_price_input, derive_event_price_from_tiers

    resp = build_event_response(event, session)
    assert resp.is_ticketing_enabled is True
    assert len(resp.ticket_tiers) == 2
    resp_tier_names = {t.name for t in resp.ticket_tiers}
    assert "Early Bird Discount" in resp_tier_names
    assert "VIP Pass" in resp_tier_names


def test_parse_price_input_standard_events():
    from app.utils.price_age_parser import parse_price_input

    # Free variants
    assert parse_price_input("0") == ("Free", 0.0)
    assert parse_price_input("0.00") == ("Free", 0.0)
    assert parse_price_input("Free") == ("Free", 0.0)
    assert parse_price_input("FREE") == ("Free", 0.0)
    assert parse_price_input(0) == ("Free", 0.0)
    assert parse_price_input(None) == ("Free", 0.0)
    assert parse_price_input("") == ("Free", 0.0)

    # Numeric inputs without symbol -> automatically prepend £
    assert parse_price_input("15") == ("£15", 15.0)
    assert parse_price_input("15.50") == ("£15.50", 15.50)
    assert parse_price_input("12") == ("£12", 12.0)
    assert parse_price_input(15.5) == ("£15.50", 15.5)

    # Pre-formatted or custom text
    assert parse_price_input("£10") == ("£10", 10.0)
    assert parse_price_input("£10 - £15") == ("£10 - £15", 10.0)
    assert parse_price_input("Donation") == ("Donation", 0.0)
    assert parse_price_input("Pay what you can") == ("Pay what you can", 0.0)


def test_derive_event_price_from_tiers():
    from app.utils.price_age_parser import derive_event_price_from_tiers

    # 1. Single free tier
    tiers = [{"name": "Free Entry", "price": 0.0}]
    display, min_p = derive_event_price_from_tiers(tiers, pass_fees_to_buyer=True)
    assert display == "Free"
    assert min_p == 0.0

    # 2. Single paid tier with pass-through fees (3.5% + £0.30)
    # £10.00 -> fee = £0.35 + £0.30 = £0.65 -> Total = £10.65
    tiers = [{"name": "Standard", "price": 10.0}]
    display, min_p = derive_event_price_from_tiers(tiers, pass_fees_to_buyer=True)
    assert display == "£10.65"
    assert min_p == 10.65

    # 3. Single paid tier with absorbed fees
    display, min_p = derive_event_price_from_tiers(tiers, pass_fees_to_buyer=False)
    assert display == "£10.00"
    assert min_p == 10.0

    # 4. Multiple tiers with pass-through fees (£10.00 and £25.00)
    # £10.00 -> £10.65, £25.00 -> fee = £0.875 + £0.30 = £1.18 -> Total = £26.18
    multi_tiers = [
        {"name": "Standard", "price": 10.0},
        {"name": "VIP", "price": 25.0},
    ]
    display, min_p = derive_event_price_from_tiers(multi_tiers, pass_fees_to_buyer=True)
    assert display == "From £10.65"
    assert min_p == 10.65

    # 5. Multiple tiers with free and paid
    free_and_paid = [
        {"name": "General Free", "price": 0.0},
        {"name": "VIP", "price": 20.0},
    ]
    display, min_p = derive_event_price_from_tiers(free_and_paid, pass_fees_to_buyer=True)
    assert display == "From Free"
    assert min_p == 0.0

