-- Fix Rate Limit Function for payment_submissions
-- Re-creates the check_payment_submission_rate_limit to ensure it uses created_at
-- instead of application_date which might cause column not found errors.

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
$$ LANGUAGE plpgsql;

-- Also recreate the trigger just to be safe, dropping any mistakenly assigned triggers
DROP TRIGGER IF EXISTS trg_vendor_application_rate_limit ON public.payment_submissions;
DROP TRIGGER IF EXISTS trg_payment_submission_rate_limit ON public.payment_submissions;

CREATE TRIGGER trg_payment_submission_rate_limit
    BEFORE INSERT ON public.payment_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_payment_submission_rate_limit();
