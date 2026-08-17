import pytest
from datetime import datetime
from sqlmodel import Session
from unittest.mock import MagicMock

from app.models import Event, TicketTier, PromoCode, Order, User, Organizer, PlatformSettings
from app.services.fee_service import calculate_order_fees

def test_standard_fee():
    # Setup
    session = MagicMock(spec=Session)
    session.get.return_value = None # Use default settings (3.5%, 0.30, 75.0)
    
    # Not first time, not pro (so 3.5% + 0.30 per ticket)
    session.exec.return_value.first.side_effect = [
        2, # First query: ticketing_events_count (not 1st time)
        2, # Second query: monthly_events_count (not pro)
        0.0 # Third query: cumulative_fees
    ]
    
    event = Event(id="e1", organizer_id="org1", pass_fees_to_buyer=False)
    tier = TicketTier(id="t1", event_id="e1", price=20.0, name="Standard")
    tier_items = [(tier, 2)] # 2 tickets at 20.0 = 40.0
    
    breakdown = calculate_order_fees(event, tier_items, None, session)
    
    assert breakdown.gross_amount == 40.0
    # Fee per ticket: 20 * 0.035 + 0.30 = 0.70 + 0.30 = 1.00
    # Total fee: 2 tickets = 2.00
    assert breakdown.platform_fee_amount == 2.00
    assert breakdown.net_organizer_amount == 38.00
    assert breakdown.pass_fees_to_buyer is False

def test_pass_fees_to_buyer():
    session = MagicMock(spec=Session)
    session.get.return_value = None
    
    session.exec.return_value.first.side_effect = [
        2,
        2,
        0.0
    ]
    
    event = Event(id="e1", organizer_id="org1", pass_fees_to_buyer=True)
    tier = TicketTier(id="t1", event_id="e1", price=20.0, name="Standard")
    tier_items = [(tier, 2)] # Subtotal = 40.0
    
    breakdown = calculate_order_fees(event, tier_items, None, session)
    
    # Fee per ticket: 20 * 0.035 + 0.30 = 1.00 -> Total fee = 2.00
    # Buyer pays: Subtotal + Fee = 40.00 + 2.00 = 42.00
    # Organizer receives: exactly Subtotal = 40.00
    assert breakdown.subtotal_amount == 40.00
    assert breakdown.platform_fee_amount == 2.00
    assert breakdown.gross_amount == 42.00
    assert breakdown.net_organizer_amount == 40.00
    assert breakdown.pass_fees_to_buyer is True

def test_dynamic_custom_fee_settings():
    session = MagicMock(spec=Session)
    # Custom admin configured fee: 5% + £0.50 per ticket, cap at £50
    session.get.return_value = PlatformSettings(
        id="global",
        base_percentage=5.0,
        base_flat_fee=0.50,
        hard_cap_amount=50.00
    )
    
    session.exec.return_value.first.side_effect = [
        2, # not 1st time
        2, # not pro
        0.0 # 0 cumulative
    ]
    
    event = Event(id="e1", organizer_id="org1", pass_fees_to_buyer=True)
    tier = TicketTier(id="t1", event_id="e1", price=30.0, name="Standard")
    tier_items = [(tier, 2)] # 2 tickets at 30 = 60.0
    
    breakdown = calculate_order_fees(event, tier_items, None, session)
    
    # Fee per ticket: 30 * 0.05 + 0.50 = 1.50 + 0.50 = 2.00
    # Total fee: 2 tickets = 4.00
    # Buyer pays: 60.00 + 4.00 = 64.00
    # Organizer receives: 60.00
    assert breakdown.subtotal_amount == 60.00
    assert breakdown.platform_fee_amount == 4.00
    assert breakdown.gross_amount == 64.00
    assert breakdown.net_organizer_amount == 60.00

def test_first_time_poster_fee():
    session = MagicMock(spec=Session)
    session.get.return_value = None
    
    # 1st time poster (1 event), not pro
    session.exec.return_value.first.side_effect = [
        1, 
        1, 
        0.0
    ]
    
    event = Event(id="e1", organizer_id="org1", pass_fees_to_buyer=False)
    tier = TicketTier(id="t1", event_id="e1", price=20.0, name="Standard")
    tier_items = [(tier, 2)]
    
    breakdown = calculate_order_fees(event, tier_items, None, session)
    
    assert breakdown.gross_amount == 40.0
    # Fee per ticket: 20 * 0.0175 + 0.15 = 0.35 + 0.15 = 0.50
    # Total fee: 2 tickets = 1.00
    assert breakdown.platform_fee_amount == 1.00
    assert breakdown.net_organizer_amount == 39.00

def test_pro_poster_fee():
    session = MagicMock(spec=Session)
    session.get.return_value = None
    
    # Not 1st time (4 events), Pro (4 events this month)
    session.exec.return_value.first.side_effect = [
        4, 
        4, 
        0.0
    ]
    
    event = Event(id="e1", organizer_id="org1", pass_fees_to_buyer=False)
    tier = TicketTier(id="t1", event_id="e1", price=20.0, name="Standard")
    tier_items = [(tier, 2)]
    
    breakdown = calculate_order_fees(event, tier_items, None, session)
    
    assert breakdown.gross_amount == 40.0
    # Fee per ticket: 20 * 0.02 + 0.20 = 0.40 + 0.20 = 0.60
    # Total fee: 2 tickets = 1.20
    assert breakdown.platform_fee_amount == 1.20
    assert breakdown.net_organizer_amount == 38.80

def test_hard_cap_fee():
    session = MagicMock(spec=Session)
    session.get.return_value = None
    
    # Standard fee
    session.exec.return_value.first.side_effect = [
        2, 
        2, 
        70.0 # Already collected £70
    ]
    
    event = Event(id="e1", organizer_id="org1", pass_fees_to_buyer=False)
    tier = TicketTier(id="t1", event_id="e1", price=50.0, name="VIP")
    # 5 tickets at 50.0 = 250.0
    # Standard Fee per ticket: 50 * 0.035 + 0.30 = 1.75 + 0.30 = 2.05
    # Total fee before cap: 5 * 2.05 = 10.25
    # Since we have collected 70, the max remaining is 5.00
    tier_items = [(tier, 5)] 
    
    breakdown = calculate_order_fees(event, tier_items, None, session)
    
    assert breakdown.gross_amount == 250.0
    assert breakdown.platform_fee_amount == 5.00
    assert breakdown.net_organizer_amount == 245.00

def test_zero_price_no_fee():
    session = MagicMock(spec=Session)
    session.get.return_value = None
    
    # Standard fee
    session.exec.return_value.first.side_effect = [
        2, 
        2, 
        0.0
    ]
    
    event = Event(id="e1", organizer_id="org1", pass_fees_to_buyer=False)
    tier = TicketTier(id="t1", event_id="e1", price=0.0, name="Free RSVP")
    tier_items = [(tier, 2)]
    
    breakdown = calculate_order_fees(event, tier_items, None, session)
    
    assert breakdown.gross_amount == 0.0
    assert breakdown.platform_fee_amount == 0.0
    assert breakdown.net_organizer_amount == 0.0

def test_promo_discount_percentage():
    session = MagicMock(spec=Session)
    session.get.return_value = None
    
    # Standard fee
    session.exec.return_value.first.side_effect = [
        2, 
        2, 
        0.0
    ]
    
    event = Event(id="e1", organizer_id="org1", pass_fees_to_buyer=False)
    tier = TicketTier(id="t1", event_id="e1", price=20.0, name="Standard")
    tier_items = [(tier, 2)] # Gross = 40.0
    
    promo = PromoCode(id="p1", event_id="e1", code_text="HALF", discount_type="percentage", discount_value=50.0)
    
    breakdown = calculate_order_fees(event, tier_items, promo, session)
    
    assert breakdown.discount_amount == 20.0
    assert breakdown.gross_amount == 20.0
    # Fees are calculated based on original base price and quantities (Highland rules state 3.5% + 0.30 per ticket)
    # Fee: 2 * (20*0.035 + 0.30) = 2.00
    assert breakdown.platform_fee_amount == 2.00
    assert breakdown.net_organizer_amount == 18.00
