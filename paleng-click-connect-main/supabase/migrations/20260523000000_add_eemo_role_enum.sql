-- Migration: Add EEMO to app_role enum
-- Enums cannot be updated and referenced in the same transaction block.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'eemo';
