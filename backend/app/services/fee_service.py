from dataclasses import dataclass
from typing import List, Tuple, Optional
from datetime import datetime, timedelta
from sqlmodel import Session, select, func

from app.models import Event, TicketTier, PromoCode, Order, PlatformSettings

@dataclass
class FeeBreakdown:
    subtotal_amount: float
    gross_amount: float
    discount_amount: float
    platform_fee_amount: float
    net_organizer_amount: float
    pass_fees_to_buyer: bool

def calculate_order_fees(
    event: Event, 
    tier_items: List[Tuple[TicketTier, int]], 
    promo: Optional[PromoCode], 
    session: Session
) -> FeeBreakdown:
    """
    Calculates exact amounts and Platform Fees for an order.
    Enforces dynamic global platform settings, Highland Loyalty rules, and the Hard Cap.
    Supports organizer fee pass-through (pass_fees_to_buyer).
    """
    
    # 1. Base Ticket Subtotal Amount
    raw_subtotal = 0.0
    for tier, qty in tier_items:
        raw_subtotal += tier.price * qty
        
    discount_amount = 0.0
    if promo:
        if promo.discount_type == "percentage":
            discount_amount = (raw_subtotal * promo.discount_value) / 100.0
        elif promo.discount_type == "fixed_amount":
            discount_amount = promo.discount_value
            
        discount_amount = min(discount_amount, raw_subtotal)
        subtotal_amount = max(0.0, raw_subtotal - discount_amount)
    else:
        subtotal_amount = raw_subtotal

    pass_fees = bool(getattr(event, "pass_fees_to_buyer", False))
        
    # Free order fast-path
    if subtotal_amount <= 0.0:
        return FeeBreakdown(
            subtotal_amount=0.0,
            gross_amount=0.0,
            discount_amount=round(discount_amount, 2),
            platform_fee_amount=0.0,
            net_organizer_amount=0.0,
            pass_fees_to_buyer=pass_fees
        )
        
    # 2. Fetch Global Fee Settings
    settings = session.get(PlatformSettings, "global")
    base_percentage = settings.base_percentage if settings else 3.5
    base_flat_fee = settings.base_flat_fee if settings else 0.30
    hard_cap_amount = settings.hard_cap_amount if settings else 75.00

    # Highland Loyalty rules check
    organizer_id = event.organizer_id
    
    # Is it First-Time Poster? (1 event with ticketing enabled and published)
    ticketing_events_count = session.exec(
        select(func.count(Event.id))
        .where(Event.organizer_id == organizer_id)
        .where(Event.is_ticketing_enabled == True)
        .where(Event.status == "published")
    ).first()
    
    is_first_time = (ticketing_events_count <= 1)
    
    # Is it Pro Poster? (3+ events this month)
    now = datetime.utcnow()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_events_count = session.exec(
        select(func.count(Event.id))
        .where(Event.organizer_id == organizer_id)
        .where(Event.is_ticketing_enabled == True)
        .where(Event.status == "published")
        .where(Event.created_at >= start_of_month)
    ).first()
    
    is_pro = (monthly_events_count >= 3)
    
    # Calculate fee per item
    platform_fee_amount = 0.0
    
    for tier, qty in tier_items:
        if tier.price == 0:
            continue
            
        if is_first_time:
            # 50% discount on base fee
            fee_per_ticket = (tier.price * (base_percentage / 200.0)) + (base_flat_fee / 2.0)
        elif is_pro:
            # Pro poster rate: 2.0% + £0.20 (capped at base settings)
            pro_pct = min(2.0, base_percentage)
            pro_flat = min(0.20, base_flat_fee)
            fee_per_ticket = (tier.price * (pro_pct / 100.0)) + pro_flat
        else:
            # Standard Rate
            fee_per_ticket = (tier.price * (base_percentage / 100.0)) + base_flat_fee
            
        platform_fee_amount += (fee_per_ticket * qty)
        
    platform_fee_amount = round(platform_fee_amount, 2)
    
    # 3. Apply cumulative limits (The Hard Cap)
    cumulative_fees = session.exec(
        select(func.sum(Order.platform_fee_amount))
        .where(Order.event_id == event.id)
        .where(Order.status == "completed")
    ).first()
    cumulative_fees = float(cumulative_fees or 0.0)
    
    max_remaining_fee = max(0.0, hard_cap_amount - cumulative_fees)
    
    if platform_fee_amount > max_remaining_fee:
        platform_fee_amount = max_remaining_fee
        
    platform_fee_amount = round(platform_fee_amount, 2)
    subtotal_amount = round(subtotal_amount, 2)

    # 4. Pass fees to buyer vs. absorb into ticket revenue
    if pass_fees:
        gross_amount = round(subtotal_amount + platform_fee_amount, 2)
        net_organizer_amount = subtotal_amount
    else:
        # Platform fee cannot exceed subtotal
        platform_fee_amount = min(platform_fee_amount, subtotal_amount)
        gross_amount = subtotal_amount
        net_organizer_amount = round(gross_amount - platform_fee_amount, 2)
    
    return FeeBreakdown(
        subtotal_amount=subtotal_amount,
        gross_amount=gross_amount,
        discount_amount=round(discount_amount, 2),
        platform_fee_amount=platform_fee_amount,
        net_organizer_amount=net_organizer_amount,
        pass_fees_to_buyer=pass_fees
    )
