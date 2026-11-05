"""Invoice contact regressions without database or external service access."""
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.api.organizer_ticketing import get_single_invoice_detail
from app.models.event import Event
from app.models.order import Order


def invoice_for(profile, *, username="event-owner", viewer=None, event_id="event", owner_id="owner"):
    event = SimpleNamespace(
        id=event_id, organizer_id=owner_id, organizer_profile_id=f"group-{event_id}" if profile else None,
        organizer_profile=profile, organizer=SimpleNamespace(username=username, email="private@example.test"),
        venue=None, location_name=None, title="Event", date_start=datetime(2026, 11, 5),
    )
    order = SimpleNamespace(
        id="order", order_ref="HEH-TEST", event_id=event.id, created_at=datetime(2026, 11, 5),
        total_amount=50, platform_fee_amount=3, status="completed",
        buyer_name="Buyer", buyer_email="buyer@example.test",
    )
    session = Mock()
    session.get.side_effect = lambda model, key: order if model is Order else event if model is Event else None
    session.exec.return_value.all.return_value = []
    viewer = viewer or SimpleNamespace(id="admin", username="Platform Owner", email="admin@example.test", is_admin=True)
    return get_single_invoice_detail(order.id, current_user=viewer, session=session)


def test_invoice_uses_public_organizer_contact_independent_of_viewer():
    profile = SimpleNamespace(name="Visit Cromarty", public_email="visit@example.test")
    for viewer in (None, SimpleNamespace(id="owner", email="private@example.test", username="Owner")):
        invoice = invoice_for(profile, viewer=viewer)
        assert invoice["platform"]["support_email"] == "contact@highlandeventshub.co.uk"
        assert invoice["organizer"] == {"name": "Visit Cromarty", "email": "visit@example.test"}
        assert invoice["financials"] == {"gross_amount": 50, "platform_fee": 3, "net_payout": 47, "currency": "GBP"}


def test_different_events_do_not_share_organizer_contact():
    first = invoice_for(SimpleNamespace(name="First", public_email="first@example.test"), event_id="first", owner_id="first-owner")
    second = invoice_for(SimpleNamespace(name="Second", public_email="second@example.test"), event_id="second", owner_id="second-owner")
    assert first["organizer"] == {"name": "First", "email": "first@example.test"}
    assert second["organizer"] == {"name": "Second", "email": "second@example.test"}


@pytest.mark.parametrize("email", [None, "", "   "])
def test_missing_public_contact_never_uses_private_or_viewer_email(email):
    assert invoice_for(SimpleNamespace(name="Group", public_email=email))["organizer"] == {"name": "Group", "email": None}


def test_no_profile_uses_event_owner_name_and_omits_private_email():
    assert invoice_for(None)["organizer"] == {"name": "event-owner", "email": None}
    assert invoice_for(None, username=None)["organizer"] == {"name": "Organizer", "email": None}


def test_print_pdf_shares_invoice_contacts_and_omits_missing_email():
    source = (Path(__file__).parents[2] / "frontend/src/pages/organizers/invoices/[order_id].tsx").read_text(encoding="utf-8")
    assert "window.print()" in source
    assert "invoice.platform.support_email" in source
    assert "{invoice.organizer.email && <> ({invoice.organizer.email})</>}" in source
    assert "support@highlandeventshub.co.uk" not in source
