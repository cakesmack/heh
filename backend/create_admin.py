"""
One-time script to create admin user.
Run from Render Shell: cd backend && python create_admin.py
Delete this file after use!
"""
import uuid
from datetime import datetime
from sqlalchemy import text
from app.core.database import engine
from app.core.security import hash_password

# ========== CONFIGURE THESE ==========
ADMIN_EMAIL = "cmack6189@gmail.com"
ADMIN_USERNAME = "cmack"
ADMIN_PASSWORD = "Smccjd9816!"
ADMIN_DISPLAY_NAME = "Admin"
# =====================================

def create_admin():
    hashed = hash_password(ADMIN_PASSWORD)
    user_id = str(uuid.uuid4()).replace('-', '')
    created_at = datetime.utcnow().isoformat()
    
    with engine.connect() as conn:
        # Check if user exists
        result = conn.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {'email': ADMIN_EMAIL}
        )
        if result.fetchone():
            print(f"User {ADMIN_EMAIL} already exists!")
            # Just promote to admin
            conn.execute(
                text("UPDATE users SET is_admin = true WHERE email = :email"),
                {'email': ADMIN_EMAIL}
            )
            conn.commit()
            print(f"Promoted {ADMIN_EMAIL} to admin!")
            return
        
        # Create new user (compatible with SQLite and PostgreSQL)
        conn.execute(text('''
            INSERT INTO users (id, email, username, display_name, password_hash, is_admin, created_at, trust_level)
            VALUES (:id, :email, :username, :display_name, :password, 1, :created_at, 'standard')
        '''), {
            'id': user_id,
            'email': ADMIN_EMAIL,
            'username': ADMIN_USERNAME,
            'display_name': ADMIN_DISPLAY_NAME,
            'password': hashed,
            'created_at': created_at
        })
        conn.commit()
        print(f"Created admin user: {ADMIN_EMAIL}")
        print(f"Password: {ADMIN_PASSWORD}")
        print("\n*** DELETE THIS FILE AFTER USE! ***")

if __name__ == "__main__":
    create_admin()

