"""
PII (Personally Identifiable Information) utilities.
Provides functions for redacting sensitive data before logging.
"""


def mask_email(email: str) -> str:
    """
    Mask an email address for safe logging.
    
    Examples:
        john.doe@example.com -> j***@example.com
        ab@test.org -> a***@test.org
        a@x.com -> a***@x.com
    """
    if not email or "@" not in email:
        return "***@***"
    
    local, domain = email.rsplit("@", 1)
    
    if len(local) == 0:
        masked_local = "***"
    elif len(local) == 1:
        masked_local = f"{local[0]}***"
    else:
        masked_local = f"{local[0]}***"
    
    return f"{masked_local}@{domain}"


def mask_user_id(user_id: str, visible_chars: int = 8) -> str:
    """
    Mask a user ID for logging, showing only first N characters.
    
    Examples:
        abc123def456 -> abc123de...
    """
    if not user_id:
        return "***"
    
    if len(user_id) <= visible_chars:
        return user_id
    
    return f"{user_id[:visible_chars]}..."
