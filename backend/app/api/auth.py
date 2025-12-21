"""
Authentication API routes.
Handles user registration, login, profile retrieval, and password reset.
"""
from datetime import datetime, timedelta
import secrets
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel, EmailStr

from app.core.database import get_session
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)
from app.models.user import User
from app.models.password_reset import PasswordResetToken
from app.core.config import settings
from app.services.email_service import send_password_reset_email
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    UserProfile,
    TokenResponse
)
from app.utils.validators import validate_email, validate_password

router = APIRouter(tags=["Authentication"])


class GoogleTokenRequest(BaseModel):
    """Schema for Google OAuth token."""
    token: str



@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    user_data: UserCreate,
    session: Session = Depends(get_session)
):
    """
    Register a new user account.

    Returns JWT access token upon successful registration.
    """
    # Validate email
    email_valid, email_error = validate_email(user_data.email)
    if not email_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=email_error
        )

    # Validate password
    password_valid, password_error = validate_password(user_data.password)
    if not password_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=password_error
        )

    # Check if user already exists (email or username)
    existing_user = session.exec(
        select(User).where((User.email == user_data.email) | (User.username == user_data.username))
    ).first()

    if existing_user:
        if existing_user.email == user_data.email:
            detail = "Email already registered"
        else:
            detail = "Username already taken"
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )

    # Create new user
    hashed_password = hash_password(user_data.password)
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        display_name=user_data.username,  # Default display name to username
        password_hash=hashed_password
    )

    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    # Create access token
    access_token = create_access_token(data={"sub": str(new_user.id)})

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(new_user)
    )


@router.post("/login", response_model=TokenResponse)
def login(
    credentials: UserLogin,
    session: Session = Depends(get_session)
):
    """
    Login with email and password.

    Returns JWT access token upon successful authentication.
    """
    # Find user by email
    user = session.exec(
        select(User).where(User.email == credentials.email)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


@router.post("/google", response_model=TokenResponse)
async def google_login(
    request: GoogleTokenRequest,
    session: Session = Depends(get_session)
):
    """
    Login or register using Google OAuth token.
    
    Verifies the Google access token, finds or creates user, and returns JWT.
    """
    # Verify the Google token by calling Google's UserInfo API
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {request.token}"}
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid Google token"
                )
            
            google_user_info = response.json()
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Failed to verify Google token"
            )
    
    # Extract email from Google response
    email = google_user_info.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not provided by Google"
        )
    
    # Check if user exists
    user = session.exec(
        select(User).where(User.email == email)
    ).first()
    
    if not user:
        # Create new user with random password (they'll use Google login)
        random_password = secrets.token_urlsafe(32)
        hashed_password = hash_password(random_password)
        
        # Generate username from email (before @)
        base_username = email.split("@")[0]
        username = base_username
        counter = 1
        
        # Ensure username is unique
        while session.exec(select(User).where(User.username == username)).first():
            username = f"{base_username}{counter}"
            counter += 1
        
        # Use Google name if available
        display_name = google_user_info.get("name") or username
        
        user = User(
            email=email,
            username=username,
            display_name=display_name,
            password_hash=hashed_password
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserProfile)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get current authenticated user's profile with stats.

    Requires valid JWT token.
    """
    # Count user statistics
    total_checkins = len(current_user.check_ins)
    total_events_submitted = len(current_user.submitted_events)

    return UserProfile(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        display_name=current_user.display_name,
        is_admin=current_user.is_admin,
        created_at=current_user.created_at,
        total_checkins=total_checkins,
        total_events_submitted=total_events_submitted
    )


# ============================================================
# PASSWORD RESET ENDPOINTS
# ============================================================

class ForgotPasswordRequest(BaseModel):
    """Request body for forgot password endpoint."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Request body for reset password endpoint."""
    token: str
    new_password: str


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    request: ForgotPasswordRequest,
    session: Session = Depends(get_session)
):
    """
    Request a password reset email.
    
    Always returns success message to prevent email enumeration.
    """
    # Generic success message (shown regardless of whether email exists)
    success_message = "If an account with that email exists, we've sent a password reset link."
    
    # Find user by email
    user = session.exec(
        select(User).where(User.email == request.email)
    ).first()
    
    if not user:
        # Return success even if user doesn't exist (security)
        return MessageResponse(message=success_message)
    
    # Delete any existing tokens for this email (cleanup)
    existing_tokens = session.exec(
        select(PasswordResetToken).where(PasswordResetToken.email == request.email)
    ).all()
    for token in existing_tokens:
        session.delete(token)
    
    # Generate new token
    raw_token = secrets.token_urlsafe(32)
    hashed_token = hash_password(raw_token)  # Hash for storage security
    
    # Calculate expiration
    expires_at = datetime.utcnow() + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)
    
    # Create and save token
    reset_token = PasswordResetToken(
        email=request.email,
        token=hashed_token,
        expires_at=expires_at
    )
    session.add(reset_token)
    session.commit()
    
    # Send email (with raw token in link)
    email_sent = send_password_reset_email(request.email, raw_token)
    
    if not email_sent:
        # Log the error but still return success for security
        import logging
        logging.error(f"Failed to send password reset email to {request.email}")
    
    return MessageResponse(message=success_message)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    request: ResetPasswordRequest,
    session: Session = Depends(get_session)
):
    """
    Reset password using a valid token.
    
    Token must be valid and not expired.
    """
    # Validate new password
    password_valid, password_error = validate_password(request.new_password)
    if not password_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=password_error
        )
    
    # Find all non-expired tokens for verification
    # We need to check all tokens since we hash them
    all_tokens = session.exec(
        select(PasswordResetToken).where(
            PasswordResetToken.expires_at > datetime.utcnow()
        )
    ).all()
    
    # Find matching token
    matching_token = None
    for token_record in all_tokens:
        if verify_password(request.token, token_record.token):
            matching_token = token_record
            break
    
    if not matching_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Find user
    user = session.exec(
        select(User).where(User.email == matching_token.email)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    # Update password
    user.password_hash = hash_password(request.new_password)
    session.add(user)
    
    # Delete the used token
    session.delete(matching_token)
    
    # Also delete any other tokens for this email
    other_tokens = session.exec(
        select(PasswordResetToken).where(PasswordResetToken.email == matching_token.email)
    ).all()
    for token in other_tokens:
        session.delete(token)
    
    session.commit()
    
    return MessageResponse(message="Password has been reset successfully. You can now login with your new password.")
