"""
General validation utilities.
Handles email, password, and other input validation.
"""
import re
from typing import Tuple


def validate_email(email: str) -> Tuple[bool, str]:
    """
    Validate email format.

    Args:
        email: Email address string

    Returns:
        Tuple of (is_valid, error_message)
    """
    # Basic email regex pattern
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

    if not email:
        return (False, "Email is required")

    if not re.match(pattern, email):
        return (False, "Invalid email format")

    if len(email) > 255:
        return (False, "Email is too long")

    return (True, "")


def validate_password(password: str) -> Tuple[bool, str]:
    """
    Validate password strength.

    Requirements:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit

    Args:
        password: Password string

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not password:
        return (False, "Password is required")

    if len(password) < 8:
        return (False, "Password must be at least 8 characters long")

    if len(password) > 100:
        return (False, "Password is too long (max 100 characters)")

    if not re.search(r'[A-Z]', password):
        return (False, "Password must contain at least one uppercase letter")

    if not re.search(r'[a-z]', password):
        return (False, "Password must contain at least one lowercase letter")

    if not re.search(r'\d', password):
        return (False, "Password must contain at least one digit")

    return (True, "")


def validate_phone(phone: str) -> Tuple[bool, str]:
    """
    Validate phone number format.

    Accepts various formats:
    - +44 1234 567890
    - 01234 567890
    - +441234567890
    - 01234567890

    Args:
        phone: Phone number string

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not phone:
        return (True, "")  # Phone is optional

    # Remove spaces and dashes
    cleaned = re.sub(r'[\s-]', '', phone)

    # Check if it contains only digits and optional leading +
    if not re.match(r'^\+?\d+$', cleaned):
        return (False, "Phone number must contain only digits")

    # Check length (between 10 and 15 digits is reasonable)
    digit_count = len(re.sub(r'\D', '', cleaned))
    if digit_count < 10 or digit_count > 15:
        return (False, "Phone number must be between 10 and 15 digits")

    return (True, "")


def validate_url(url: str) -> Tuple[bool, str]:
    """
    Validate URL format.

    Args:
        url: URL string

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not url:
        return (True, "")  # URL is optional

    # Basic URL pattern
    pattern = r'^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}.*$'

    if not re.match(pattern, url):
        return (False, "Invalid URL format. Must start with http:// or https://")

    if len(url) > 500:
        return (False, "URL is too long")

    return (True, "")


def sanitize_string(text: str, max_length: int = None) -> str:
    """
    Sanitize string input by trimming whitespace and limiting length.

    Args:
        text: Input string
        max_length: Maximum allowed length (no limit if None)

    Returns:
        Sanitized string
    """
    if not text:
        return ""

    # Trim whitespace
    sanitized = text.strip()

    # Limit length if specified
    if max_length and len(sanitized) > max_length:
        sanitized = sanitized[:max_length]

    return sanitized
