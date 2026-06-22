-- Purge test featured bookings for cmack6189@gmail.com that are CANCELLED or COMPLETED
DELETE FROM featured_bookings
WHERE organizer_id IN (
    SELECT id FROM users WHERE email = 'cmack6189@gmail.com'
) AND (
    status = 'CANCELLED' OR status = 'COMPLETED'
);
