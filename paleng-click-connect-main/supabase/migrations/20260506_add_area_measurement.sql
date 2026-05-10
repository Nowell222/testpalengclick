-- Migration: Add Area Measurement to Stalls
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS area_measurement text;
