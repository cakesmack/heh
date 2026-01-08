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
        price_input: Can be a string like "Free", "£5", "£5-£10" or a float like 5.0
        
    Returns:
        Tuple of (price_display: str, min_price: float)
        
    Examples:
        parse_price_input("Free") -> ("Free", 0.0)
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
    price_lower = price_str.lower()
    
    # Check for free/donation keywords
    if any(keyword in price_lower for keyword in ['free', 'donation', 'n/a', 'tbc', 'tba']):
        return (price_str if price_str else "Free", 0.0)
    
    # Try to find the first number in the string (the minimum price)
    match = re.search(r'[\d]+\.?[\d]*', price_str)
    if match:
        try:
            min_price = float(match.group())
            return (price_str, min_price)
        except ValueError:
            pass
    
    # Couldn't parse a number, treat as free
    return (price_str if price_str else "Free", 0.0)


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
