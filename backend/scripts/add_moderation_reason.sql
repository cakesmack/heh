-- Add moderation_reason field to events table
-- This stores WHY an event was flagged by the content filter

ALTER TABLE events ADD COLUMN IF NOT EXISTS moderation_reason VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN events.moderation_reason IS 'Content filter trigger reason (e.g., Contains: badword)';
