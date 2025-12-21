"""
One-time script to make a user admin.
Run this in Render Shell: python make_admin.py

This script should be deleted after use.
"""
import os
import sys

# Add the backend directory to path if needed
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, create_engine, select
from app.models.user import User

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable not set")
    sys.exit(1)

# Email to promote to admin
ADMIN_EMAIL = "highlandeventshub@gmail.com"

# Create engine and session
engine = create_engine(DATABASE_URL)

with Session(engine) as session:
    # Find user by email
    user = session.exec(select(User).where(User.email == ADMIN_EMAIL)).first()
    
    if not user:
        print(f"ERROR: User with email '{ADMIN_EMAIL}' not found")
        print("Make sure you have logged in with Google first to create the account.")
        sys.exit(1)
    
    if user.is_admin:
        print(f"User '{user.email}' is already an admin!")
    else:
        user.is_admin = True
        session.add(user)
        session.commit()
        print(f"SUCCESS! User '{user.email}' is now an admin.")
        print(f"Username: {user.username}")
        print(f"Display Name: {user.display_name}")
