"""
Rate limiter configuration using slowapi.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Initialize limiter with remote address as key
# Uses in-memory storage by default (safe for single-instance Render deployment)
limiter = Limiter(key_func=get_remote_address)
