"""
Utility functions for parsing price and age restriction inputs.
Used by event creation/update endpoints.
"""

import re
from typing import Optional, Tuple


def parse_price_input(price_input: str | float | None) -> Tuple[str, float]:
    """
    Parse price input and return both display string and numeric min_price.
    
    Args:
        price_input: Can be a string like "Free", "£5", "£5-£10", "10", "15.50" or a float like 5.0
        
    Returns:
        Tuple of (price_display: str, min_price: float)
        
    Examples:
        parse_price_input("Free") -> ("Free", 0.0)
        parse_price_input("10") -> ("£10", 10.0)
        parse_price_input("15.50") -> ("£15.50", 15.50)
        parse_price_input("£5") -> ("£5", 5.0)
        parse_price_input("£5 - £10") -> ("£5 - £10", 5.0)
        parse_price_input(5.0) -> ("£5.00", 5.0)
        parse_price_input(0) -> ("Free", 0.0)
    """
    if price_input is None:
        return ("Free", 0.0)
    
    # If it's already a number, convert to display string
    if isinstance(price_input, (int, float)):
        if price_input == 0:
            return ("Free", 0.0)
        return (f"£{float(price_input):.2f}", float(price_input))
    
    # It's a string - parse it
    price_str = str(price_input).strip()
    if not price_str:
        return ("Free", 0.0)
        
    price_lower = price_str.lower()
    
    # Check for zero strings
    if price_lower in ['0', '0.0', '0.00', '£0', '£0.00']:
        return ("Free", 0.0)
    
    # Check for free
    if price_lower in ['free', 'free entry', 'free admission']:
        return ("Free", 0.0)

    # Check for other donation keywords
    if any(keyword in price_lower for keyword in ['donation', 'n/a', 'tbc', 'tba']):
        return (price_str if price_str else "Free", 0.0)
    
    # Try to find the first number in the string (the minimum price)
    match = re.search(r'[\d]+\.?[\d]*', price_str)
    if match:
        try:
            min_price = float(match.group())
            if min_price == 0.0 and price_lower in ["0", "0.0", "0.00"]:
                return ("Free", 0.0)
            # If plain numeric string without currency symbol, prepend £
            if re.match(r'^\d+(\.\d+)?$', price_str):
                return (f"£{price_str}", min_price)
            return (price_str, min_price)
        except ValueError:
            pass
    
    # Couldn't parse a number, treat as free
    return (price_str if price_str else "Free", 0.0)


def derive_event_price_from_tiers(tiers: list, pass_fees_to_buyer: bool = False) -> Tuple[str, float]:
    """
    Derives display price string and numeric min_price from a list of ticket tiers.
    """
    if not tiers:
        return ("Free", 0.0)
    
    buyer_prices = []
    for tier in tiers:
        t_price = getattr(tier, "price", None)
        if t_price is None and isinstance(tier, dict):
            t_price = tier.get("price")
        price_val = float(t_price) if t_price is not None else 0.0
        
        if price_val <= 0.0:
            buyer_prices.append(0.0)
        elif pass_fees_to_buyer:
            fee = round((price_val * 0.035) + 0.30, 2)
            buyer_prices.append(round(price_val + fee, 2))
        else:
            buyer_prices.append(round(price_val, 2))
            
    if not buyer_prices:
        return ("Free", 0.0)
        
    min_p = min(buyer_prices)
    max_p = max(buyer_prices)
    
    if min_p == max_p:
        display_str = "Free" if min_p == 0.0 else f"£{min_p:.2f}"
    elif min_p == 0.0:
        display_str = "From Free"
    else:
        display_str = f"From £{min_p:.2f}"
        
    return (display_str, min_p)


def parse_age_input(age_input: str | int | None) -> Tuple[Optional[str], Optional[int]]:
    """
    Parse age restriction input and return both legacy string and new numeric value.
    
    Args:
        age_input: Can be a string like "18+", "All Ages" or an int like 18
        
    Returns:
        Tuple of (age_restriction: str | None, min_age: int | None)
        
    Examples:
        parse_age_input("18+") -> ("18+", 18)
        parse_age_input(18) -> ("18+", 18)
        parse_age_input(0) -> ("All Ages", 0)
        parse_age_input("All Ages") -> ("All Ages", 0)
        parse_age_input(None) -> (None, None)
    """
    if age_input is None or age_input == "" or age_input == "none":
        return (None, None)
    
    # If it's already a number
    if isinstance(age_input, int):
        if age_input == 0:
            return ("All Ages", 0)
        return (f"{age_input}+", age_input)
    
    # It's a string - parse it
    age_str = str(age_input).strip()
    age_lower = age_str.lower()
    
    # Check for "all ages" or "family" keywords
    if any(keyword in age_lower for keyword in ['all ages', 'family', 'all-ages', 'none']):
        return (age_str, 0)
    
    # Try to find a number in the string
    match = re.search(r'(\d+)', age_str)
    if match:
        try:
            min_age = int(match.group(1))
            return (age_str, min_age)
        except ValueError:
            pass
    
    # Couldn't parse, return as-is with None for numeric
    return (age_str, None)
