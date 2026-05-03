-- =============================================
-- Add Missing Vendor Application Fields
-- =============================================
-- The vendor_applications table was missing fields that the application code expects
-- This migration adds: first_name, last_name, email, phone_number, application_date, reviewed_at

ALTER TABLE public.vendor_applications
ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS phone_number TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS application_date TIMESTAMPTZ NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Add index for email to improve query performance
CREATE INDEX IF NOT EXISTS idx_vendor_applications_email ON public.vendor_applications(email);
CREATE INDEX IF NOT EXISTS idx_vendor_applications_status ON public.vendor_applications(status);
CREATE INDEX IF NOT EXISTS idx_vendor_applications_applied_at ON public.vendor_applications(applied_at DESC);
