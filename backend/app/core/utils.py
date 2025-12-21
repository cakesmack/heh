"""
Utility functions for the application.
"""


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
        return uuid_value.replace("-", "")
    return str(uuid_value).replace("-", "")

def simple_slugify(text: str) -> str:
    """
    Generate a URL-friendly slug from text.
    """
    return text.lower().replace(" ", "-").replace("'", "").replace('"', "")
