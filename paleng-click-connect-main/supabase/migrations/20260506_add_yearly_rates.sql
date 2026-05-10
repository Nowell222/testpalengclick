-- Migration: Add per-year monthly rates to Stalls (2026, 2027, 2028)
-- Vendors may have different rates per year based on area and base rate.
-- Formula: base_rate_per_sqm × area_measurement × 30 days = monthly_rate_YYYY
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS monthly_rate_2026 numeric;
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS monthly_rate_2027 numeric;
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS monthly_rate_2028 numeric;
