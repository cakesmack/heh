
import sys
import os

# Set dummy env vars to satisfy Settings validation
os.environ["SECRET_KEY"] = "insecure_key_for_script_only"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_123"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_123"

# Add backend directory to path so we can import app modules
sys.path.append(os.path.dirname(__file__))

from app.core.database import get_session
from app.models.slot_pricing import SlotPricing
from app.models.featured_booking import SlotType, SLOT_CONFIG

def update_pricing():
    session_gen = get_session()
    session = next(session_gen)
    
    try:
        print("--- UPDATING SLOT PRICING CONFIGURATION ---")
        
        for slot_type in SlotType:
            # Get hardcoded config for this slot type
            default = SLOT_CONFIG.get(slot_type)
            if not default:
                continue
                
            # Check if pricing exists in DB
            pricing = session.get(SlotPricing, slot_type.value)
            
            if not pricing:
                print(f"[NEW] Creating pricing for {slot_type.value} -> Max: {default['max']}")
                pricing = SlotPricing(
                    slot_type=slot_type.value,
                    max_concurrent=default['max'],
                    price_per_day=default['price_per_day'],
                    min_days=default['min_days'],
                    is_active=True,
                    description=f"Auto-generated config for {slot_type.value}"
                )
                session.add(pricing)
            else:
                # Force update of max_concurrent if it differs
                if pricing.max_concurrent != default['max']:
                     print(f"[FIX] Updating {slot_type.value}: Max slots {pricing.max_concurrent} -> {default['max']}")
                     pricing.max_concurrent = default['max']
                     session.add(pricing)
                else:
                     print(f"[OK] {slot_type.value}: Max slots = {pricing.max_concurrent}")
        
        session.commit()
        print("✅ Slot Pricing Update Complete.")
        
    except Exception as e:
        print(f"❌ Error updating pricing: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    update_pricing()
