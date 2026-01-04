-- ============================================================
-- ADD is_active COLUMN TO USERS TABLE
-- Highland Events Hub - User Ban/Deactivation Feature
-- ============================================================
-- 
-- Run against PostgreSQL using: psql -f add_user_is_active.sql
-- ============================================================

-- Add is_active column with default TRUE (all existing users remain active)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'is_active';

-- ============================================================
-- TO BAN A USER:
-- UPDATE users SET is_active = FALSE WHERE email = 'user@example.com';
-- ============================================================
