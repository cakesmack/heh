-- Phase 5: Add promotion and interest notification preference columns
-- Safe: uses IF NOT EXISTS pattern and DEFAULT TRUE so existing rows are unaffected

ALTER TABLE user_preferences
    ADD COLUMN IF NOT EXISTS allow_promotion_reminders BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE user_preferences
    ADD COLUMN IF NOT EXISTS receive_interest_notifications BOOLEAN NOT NULL DEFAULT TRUE;
