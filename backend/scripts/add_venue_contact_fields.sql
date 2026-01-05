-- Migration: Add email and opening_hours columns to venues table
-- Date: 2026-01-05
-- Description: Adds contact email and opening hours text fields to venues

-- Add email column (optional, max 255 chars)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add opening_hours column (optional, max 500 chars for formats like "Mon-Fri: 9-5")
ALTER TABLE venues ADD COLUMN IF NOT EXISTS opening_hours VARCHAR(500);

-- Verify columns were added
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'venues' AND column_name IN ('email', 'opening_hours');
