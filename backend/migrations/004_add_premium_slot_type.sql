-- Phase 6: Add 'premium' slot type to slottype enum
ALTER TYPE slottype ADD VALUE IF NOT EXISTS 'premium';
