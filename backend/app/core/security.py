"""
Security utilities for authentication and authorization.
Handles JWT token creation/validation and password hashing.
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select

from .config import settings
from .database import get_session


# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer token scheme
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash a plain text password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain text password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Payload to encode in the token (typically {"sub": user_id})
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return encoded_jwt


def decode_access_token(token: str) -> Optional[str]:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token string

    Returns:
        User ID (subject) from token payload, or None if invalid
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        return user_id
    except JWTError:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session)
):
    """
    FastAPI dependency that extracts and validates the current user from JWT token.

    Usage:
        @app.get("/protected")
        def protected_route(current_user: User = Depends(get_current_user)):
            ...

    Raises:
        HTTPException: If token is invalid or user not found
    """
    from app.models.user import User  # Import here to avoid circular imports

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise credentials_exception

    token = credentials.credentials
    user_id_str = decode_access_token(token)

    if user_id_str is None:
        raise credentials_exception

    # Fetch user from database using raw SQL to avoid UUID type processing issues with SQLite
    # Remove hyphens from UUID to match SQLite storage format
    user_id_normalized = user_id_str.replace("-", "")
    from sqlalchemy import text as sql_text
    statement = sql_text("SELECT id, email, password_hash, username, display_name, trust_level, is_admin, created_at FROM users WHERE id = :user_id")
    result = session.execute(statement, {"user_id": user_id_normalized})
    row = result.fetchone()

    if row is None:
        raise credentials_exception

    # Manually construct User object from row
    user = User(
        id=row[0],
        email=row[1],
        password_hash=row[2],
        username=row[3],
        display_name=row[4],
        trust_level=row[5],
        is_admin=bool(row[6]),
        created_at=row[7]
    )

    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session: Session = Depends(get_session)
) -> Optional["User"]:
    """
    FastAPI dependency that returns the current user if authenticated, else None.
    Does not raise HTTPException for invalid/missing credentials.
    """
    if not credentials:
        return None

    try:
        token = credentials.credentials
        user_id_str = decode_access_token(token)

        if user_id_str is None:
            return None

        # Fetch user from database using raw SQL to avoid UUID type processing issues with SQLite
        user_id_normalized = user_id_str.replace("-", "")
        from sqlalchemy import text as sql_text
        statement = sql_text("SELECT id, email, password_hash, username, display_name, trust_level, is_admin, created_at FROM users WHERE id = :user_id")
        result = session.execute(statement, {"user_id": user_id_normalized})
        row = result.fetchone()

        if row is None:
            return None

        from app.models.user import User
        # Manually construct User object from row
        user = User(
            id=row[0],
            email=row[1],
            password_hash=row[2],
            username=row[3],
            display_name=row[4],
            trust_level=row[5],
            is_admin=bool(row[6]),
            created_at=row[7]
        )
        return user

    except Exception:
        return None


async def get_current_active_admin(
    current_user = Depends(get_current_user)
):
    """
    FastAPI dependency that ensures the current user is an admin.

    Usage:
        @app.delete("/users/{user_id}")
        def delete_user(user_id: str, admin: User = Depends(get_current_active_admin)):
            ...

    Raises:
        HTTPException: If user is not an admin
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized. Admin access required."
        )

    return current_user
