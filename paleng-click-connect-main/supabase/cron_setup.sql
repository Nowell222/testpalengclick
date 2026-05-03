-- =============================================
-- Phase 5: Automated Cron Jobs (pg_cron setup)
-- =============================================
-- Run this script in your Supabase SQL Editor.

-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add penalty columns to payment_schedules if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_schedules' AND column_name='penalty_amount') THEN
        ALTER TABLE public.payment_schedules ADD COLUMN penalty_amount NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_schedules' AND column_name='penalty_applied_at') THEN
        ALTER TABLE public.payment_schedules ADD COLUMN penalty_applied_at TIMESTAMPTZ;
    END IF;
END $$;

-- 1. Schedule for Penalties
-- Runs every day at 12:00 AM (Midnight)
SELECT cron.schedule(
    'process-penalties-daily',
    '0 0 * * *',
    $$
    SELECT net.http_post(
        url := 'https://' || (SELECT current_setting('request.headers')::json->>'host') || '/functions/v1/process-penalties',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZWlqeGd3eGJ0eG94bnhicW5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg1NjUzMCwiZXhwIjoyMDg5NDMyNTMwfQ.jSgEH6U2hWGfM37VE0poMWMgl41jOK0XvQ7sHfqKN9Q"}'::jsonb
    ) as request_id;
    $$
);

-- 2. Schedule for Reminders
-- Runs every day at 8:00 AM
SELECT cron.schedule(
    'send-reminders-daily',
    '0 8 * * *',
    $$
    SELECT net.http_post(
        url := 'https://' || (SELECT current_setting('request.headers')::json->>'host') || '/functions/v1/send-reminders',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZWlqeGd3eGJ0eG94bnhicW5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg1NjUzMCwiZXhwIjoyMDg5NDMyNTMwfQ.jSgEH6U2hWGfM37VE0poMWMgl41jOK0XvQ7sHfqKN9Q"}'::jsonb
    ) as request_id;
    $$
);

-- Note: Replace 'YOUR_SERVICE_ROLE_KEY' in the cron schedules above with your actual Supabase service_role key 
-- before executing, or pass the key using another secure method if supported by your setup.
