-- =============================================
-- Rate Limiting for Vendor Applications
-- Prevents spam by limiting submissions to 1 per hour per email/phone
-- =============================================

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
$$ LANGUAGE plpgsql;

-- 2. Rate Limiting for Payment Submissions (Logged-in Users)
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

DROP TRIGGER IF EXISTS trg_payment_submission_rate_limit ON public.payment_submissions;
CREATE TRIGGER trg_payment_submission_rate_limit
    BEFORE INSERT ON public.payment_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_payment_submission_rate_limit();

-- Apply the trigger to the vendor_applications table
DROP TRIGGER IF EXISTS trg_vendor_application_rate_limit ON public.vendor_applications;
CREATE TRIGGER trg_vendor_application_rate_limit
    BEFORE INSERT ON public.vendor_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.check_vendor_application_rate_limit();
