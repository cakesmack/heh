-- Migration: Add receive_interest_notifications to users table
-- Date: 2026-01-10
-- Description: Adds boolean column for controlling new event notification preferences

-- Add the new column with default value TRUE
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS receive_interest_notifications BOOLEAN DEFAULT TRUE;

-- Update any NULL values to TRUE (for existing users)
UPDATE users 
SET receive_interest_notifications = TRUE 
WHERE receive_interest_notifications IS NULL;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'receive_interest_notifications';
