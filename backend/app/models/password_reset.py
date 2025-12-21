"""
Password reset token model for secure password recovery.
Tokens are single-use and expire after a configured time.
"""
from datetime import datetime
from typing import Optional
from uuid import uuid4
from sqlmodel import Field, SQLModel


class PasswordResetToken(SQLModel, table=True):
    """
    Model for storing password reset tokens.
    
    Attributes:
        id: Unique identifier
        email: User's email address (indexed for lookup)
        token: Unique reset token (hashed for security)
        expires_at: When the token expires
        created_at: When the token was created
    """
    __tablename__ = "password_reset_tokens"
    
    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    email: str = Field(index=True, max_length=255)
    token: str = Field(unique=True, max_length=255)  # Store hashed token
    expires_at: datetime = Field()
    created_at: datetime = Field(default_factory=datetime.utcnow)
