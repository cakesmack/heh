-- Migration to add Triptych fields to hero_slots table

-- Run this in your Render database console (e.g. pgAdmin, psql, or Render dashboard)

ALTER TABLE hero_slots ADD COLUMN image_override_left VARCHAR(500);
ALTER TABLE hero_slots ADD COLUMN image_override_right VARCHAR(500);

-- Verify changes
-- SELECT * FROM hero_slots LIMIT 1;
