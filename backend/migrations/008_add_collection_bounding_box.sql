-- Add min_lat, max_lat, min_lng, max_lng bounding box columns to collections table
ALTER TABLE collections ADD COLUMN IF NOT EXISTS min_lat FLOAT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS max_lat FLOAT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS min_lng FLOAT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS max_lng FLOAT;
