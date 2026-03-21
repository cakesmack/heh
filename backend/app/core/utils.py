"""
Utility functions for the application.
"""
import re
import unicodedata


STOP_WORDS = {
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'shall', 'should', 'may', 'might', 'can', 'could', 'this', 'that',
    'these', 'those', 'it', 'its',
}


def normalize_uuid(uuid_value) -> str:
    """
    Normalize UUID to match SQLite storage format (remove hyphens).

    SQLite stores UUIDs as strings without hyphens, but Python UUID objects
    and string representations often include hyphens. This function normalizes
    both formats to the unhyphenated string format used in SQLite.

    Args:
        uuid_value: UUID object, string with hyphens, or string without hyphens

    Returns:
        Unhyphenated UUID string (e.g., '529450ff523a4a6f8c97c48e68317b4d')
    """
    if isinstance(uuid_value, str):
        return uuid_value.replace("-", "").lower()
    return str(uuid_value).replace("-", "").lower()

def generate_seo_slug(text: str, max_length: int = 80) -> str:
    """
    Generate a keyword-rich, SEO-friendly URL slug.
    - Strips accents/diacritics
    - Removes special characters
    - Strips English stop words
    - Forces lowercase
    - Truncates to max_length at word boundary
    """
    # Normalize unicode -> ASCII
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = text.lower().strip()
    # Remove special characters (keep alphanumeric, spaces, hyphens)
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    # Split, strip stop words
    words = [w for w in text.split() if w not in STOP_WORDS]
    slug = "-".join(words)
    # Collapse multiple hyphens
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    # Truncate at word boundary
    if len(slug) > max_length:
        slug = slug[:max_length].rsplit("-", 1)[0]
    return slug


def simple_slugify(text: str) -> str:
    """Backward-compatible wrapper around generate_seo_slug."""
    return generate_seo_slug(text)
