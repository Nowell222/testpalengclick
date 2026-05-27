-- =============================================
-- Fix search_path on PL/pgSQL functions
-- Hardening against search path injection attacks
-- =============================================

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    old_json JSONB;
    new_json JSONB;
    record_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        new_json := to_jsonb(NEW);
        record_id := NEW.id;
    ELSIF TG_OP = 'UPDATE' THEN
        old_json := to_jsonb(OLD);
        new_json := to_jsonb(NEW);
        record_id := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        old_json := to_jsonb(OLD);
        record_id := OLD.id;
    END IF;

    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, record_id, old_json, new_json);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_vendor_application_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if an application with the same email or phone was submitted in the last hour
    IF EXISTS (
        SELECT 1 
        FROM public.vendor_applications 
        WHERE (email = NEW.email OR phone_number = NEW.phone_number)
        AND application_date > (now() - interval '1 hour')
    ) THEN
        RAISE EXCEPTION 'Too many application attempts. Please wait 1 hour before trying again with this email/phone.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_payment_submission_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
    -- Limit to 5 submissions per 24 hours per user
    IF (
        SELECT count(*) 
        FROM public.payment_submissions 
        WHERE vendor_user_id = auth.uid()
        AND created_at > (now() - interval '24 hours')
    ) >= 5 THEN
        RAISE EXCEPTION 'Daily payment submission limit reached (5). Please contact admin if you need to submit more.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
