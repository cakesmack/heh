#!/usr/bin/env python3
"""
Backfill Usernames Script
========================

Backfills 'username' for any user that doesn't have one.
Derives username from email address (local part).
Handles duplicates by appending a counter.

Usage:
    cd backend
    python scripts/backfill_usernames.py
"""
import os
import sys

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from sqlalchemy import create_engine

from app.core.config import settings
from app.models.user import User

def backfill_usernames():
    print("\n" + "=" * 60)
    print("🔄 BACKFILL USERNAMES")
    print("=" * 60)
    
    engine = create_engine(str(settings.DATABASE_URL))
    
    with Session(engine) as session:
        # Find users with no username
        users_without_username = session.exec(
            select(User).where(User.username == None)
        ).all()
        
        print(f"Found {len(users_without_username)} users without usernames.")
        
        updated_count = 0
        
        for user in users_without_username:
            print(f"Processing user: {user.email}")
            
            # Generate username from email
            base_username = user.email.split("@")[0]
            username = base_username
            counter = 1
            
            # Check for uniqueness
            while session.exec(select(User).where(User.username == username)).first():
                username = f"{base_username}{counter}"
                counter += 1
            
            user.username = username
            session.add(user)
            print(f"  ✅ Assigned username: {username}")
            updated_count += 1
            
        session.commit()
        print(f"\nSuccessfully backfilled {updated_count} users.")

if __name__ == "__main__":
    backfill_usernames()
