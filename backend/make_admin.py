#!/usr/bin/env python3
"""
Simple script to make a user admin using raw SQL.
Run with: python make_admin.py <email>
"""
import os
import sys
from sqlalchemy import create_engine, text

def make_admin(email: str):
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL environment variable not set")
        sys.exit(1)
    
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        # First check if user exists
        result = conn.execute(
            text("SELECT id, email, is_admin FROM users WHERE email = :email"),
            {"email": email}
        )
        user = result.fetchone()
        
        if not user:
            print(f"Error: User with email '{email}' not found")
            sys.exit(1)
        
        print(f"Found user: {user[1]} (admin: {user[2]})")
        
        # Update to admin
        conn.execute(
            text("UPDATE users SET is_admin = true WHERE email = :email"),
            {"email": email}
        )
        conn.commit()
        
        print(f"Success! {email} is now an admin.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Default to your email if none provided
        email = "cmack6189@gmail.com"
    else:
        email = sys.argv[1]
    
    make_admin(email)
