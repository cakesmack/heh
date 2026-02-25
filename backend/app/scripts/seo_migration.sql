-- SEO Infrastructure Migration
-- Adds seo_title, seo_description, and slug columns to events and venues tables

-- 1. Add SEO override columns to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS seo_title VARCHAR(120);
ALTER TABLE events ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS slug VARCHAR(300);

-- 2. Add SEO override columns to venues
ALTER TABLE venues ADD COLUMN IF NOT EXISTS seo_title VARCHAR(120);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS slug VARCHAR(300);

-- 3. Create partial unique indexes on slugs (NULLs are excluded, so rows without slugs don't conflict)
CREATE UNIQUE INDEX IF NOT EXISTS ix_events_slug ON events (slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ix_venues_slug ON venues (slug) WHERE slug IS NOT NULL;
