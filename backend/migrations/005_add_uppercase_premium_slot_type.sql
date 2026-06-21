-- Phase 6: Add uppercase 'PREMIUM' slot type to slottype enum
ALTER TYPE slottype ADD VALUE IF NOT EXISTS 'PREMIUM';
