-- Add view_count and link_click_count tracking to collections table
ALTER TABLE collections ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS link_click_count INTEGER DEFAULT 0 NOT NULL;
