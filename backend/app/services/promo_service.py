from datetime import datetime
from sqlmodel import Session, select
from app.models import PromoCode

def validate_promo_code(event_id: str, code_text: str, session: Session) -> PromoCode:
    """
    Validates a promo code for an event.
    Returns the PromoCode model if valid.
    Raises ValueError with a user-friendly message if invalid.
    """
    code_text = code_text.strip().upper()
    
    # We do a case-insensitive match by storing/comparing upper
    statement = (
        select(PromoCode)
        .where(PromoCode.event_id == event_id)
        .where(PromoCode.code_text == code_text)
    )
    promo = session.exec(statement).first()
    
    if not promo:
        raise ValueError("Invalid promo code.")
        
    now = datetime.utcnow()
    
    if promo.valid_from and now < promo.valid_from:
        raise ValueError("This promo code is not yet active.")
        
    if promo.valid_until and now > promo.valid_until:
        raise ValueError("This promo code has expired.")
        
    if promo.usage_limit is not None and promo.usage_count >= promo.usage_limit:
        raise ValueError("This promo code has reached its usage limit.")
        
    return promo
