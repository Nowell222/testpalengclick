-- Migration: Add BPLO to app_role enum
-- Enums cannot be updated and referenced in the same transaction block.
-- Running this in a separate migration commits the enum value change first.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'bplo';
