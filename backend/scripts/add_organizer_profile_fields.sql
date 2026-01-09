-- Migration: Add enhanced organizer profile fields
-- Run this script to add new fields to the organizers table
-- For SQLite, each ALTER TABLE only adds one column

-- Add cover image URL (3:1 aspect ratio banner)
ALTER TABLE organizers ADD COLUMN cover_image_url VARCHAR(500);

-- Add city/location field
ALTER TABLE organizers ADD COLUMN city VARCHAR(100);

-- Add individual social media links
ALTER TABLE organizers ADD COLUMN social_facebook VARCHAR(500);
ALTER TABLE organizers ADD COLUMN social_instagram VARCHAR(500);
ALTER TABLE organizers ADD COLUMN social_website VARCHAR(500);

-- Add public contact email
ALTER TABLE organizers ADD COLUMN public_email VARCHAR(255);

