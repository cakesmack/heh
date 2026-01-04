-- ============================================================
-- FOREIGN KEY CASCADE MIGRATION
-- Highland Events Hub - Database Integrity Update
-- ============================================================
-- 
-- This script adds ON DELETE behavior to foreign keys.
-- Run against PostgreSQL using: psql -f migrate_fk_cascades.sql
--
-- IMPORTANT: This is a non-destructive migration but verify backups first.
-- ============================================================

-- ============================================================
-- STEP 1: CHECKINS TABLE
-- CASCADE: Delete check-ins when user or event is deleted
-- ============================================================

ALTER TABLE checkins 
DROP CONSTRAINT IF EXISTS checkins_user_id_fkey,
ADD CONSTRAINT checkins_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE checkins 
DROP CONSTRAINT IF EXISTS checkins_event_id_fkey,
ADD CONSTRAINT checkins_event_id_fkey 
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 2: BOOKMARKS TABLE  
-- CASCADE: Delete bookmarks when user or event is deleted
-- ============================================================

ALTER TABLE bookmarks 
DROP CONSTRAINT IF EXISTS bookmarks_user_id_fkey,
ADD CONSTRAINT bookmarks_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE bookmarks 
DROP CONSTRAINT IF EXISTS bookmarks_event_id_fkey,
ADD CONSTRAINT bookmarks_event_id_fkey 
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 3: PROMOTIONS TABLE
-- CASCADE: Delete promotions when venue is deleted
-- ============================================================

ALTER TABLE promotions 
DROP CONSTRAINT IF EXISTS promotions_venue_id_fkey,
ADD CONSTRAINT promotions_venue_id_fkey 
    FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 4: FEATURED_BOOKINGS TABLE
-- CASCADE on event, SET NULL on organizer
-- ============================================================

ALTER TABLE featured_bookings 
DROP CONSTRAINT IF EXISTS featured_bookings_event_id_fkey,
ADD CONSTRAINT featured_bookings_event_id_fkey 
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- Make organizer_id nullable first if it isn't already
ALTER TABLE featured_bookings 
ALTER COLUMN organizer_id DROP NOT NULL;

ALTER TABLE featured_bookings 
DROP CONSTRAINT IF EXISTS featured_bookings_organizer_id_fkey,
ADD CONSTRAINT featured_bookings_organizer_id_fkey 
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- STEP 5: EVENTS TABLE
-- SET NULL: Preserve events even if venue/user/category deleted
-- ============================================================

-- Make organizer_id nullable (events can exist without organizer)
ALTER TABLE events 
ALTER COLUMN organizer_id DROP NOT NULL;

ALTER TABLE events 
DROP CONSTRAINT IF EXISTS events_venue_id_fkey,
ADD CONSTRAINT events_venue_id_fkey 
    FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL;

ALTER TABLE events 
DROP CONSTRAINT IF EXISTS events_organizer_id_fkey,
ADD CONSTRAINT events_organizer_id_fkey 
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE events 
DROP CONSTRAINT IF EXISTS events_category_id_fkey,
ADD CONSTRAINT events_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE events 
DROP CONSTRAINT IF EXISTS events_organizer_profile_id_fkey,
ADD CONSTRAINT events_organizer_profile_id_fkey 
    FOREIGN KEY (organizer_profile_id) REFERENCES organizers(id) ON DELETE SET NULL;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check all FK constraints now have ON DELETE behavior
SELECT 
    tc.table_name, 
    tc.constraint_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('checkins', 'bookmarks', 'promotions', 'featured_bookings', 'events')
ORDER BY tc.table_name;

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- To revert, run ALTER TABLE commands with ON DELETE NO ACTION
-- Example:
-- ALTER TABLE checkins DROP CONSTRAINT checkins_user_id_fkey,
-- ADD CONSTRAINT checkins_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
