-- Phase 5: Hero Slots Table Teardown
-- Drops the deprecated hero_slots table and updates the magazine carousel slot limit.

DROP TABLE IF EXISTS hero_slots CASCADE;

UPDATE slot_pricing SET max_slots = 4 WHERE slot_type = 'MAGAZINE_CAROUSEL';
