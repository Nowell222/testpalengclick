-- Migration: Prevent duplicate payment receipt reference numbers in payment_submissions
-- 1. Create SECURITY DEFINER RPC function so any user can check reference number existence bypassing RLS
CREATE OR REPLACE FUNCTION public.check_reference_exists(p_reference TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cleaned TEXT;
BEGIN
    IF p_reference IS NULL OR trim(p_reference) = '' THEN
        RETURN FALSE;
    END IF;

    -- Strip non-alphanumeric characters for strict matching (e.g. "1234-5678 90" -> "1234567890")
    cleaned := LOWER(regexp_replace(p_reference, '[^a-zA-Z0-9]', '', 'g'));
    IF length(cleaned) < 4 THEN
        RETURN FALSE;
    END IF;

    -- Check payment_submissions (pending or accepted/approved)
    IF EXISTS (
        SELECT 1 
        FROM public.payment_submissions 
        WHERE LOWER(regexp_replace(COALESCE(ocr_reference, ''), '[^a-zA-Z0-9]', '', 'g')) = cleaned
        AND status IN ('pending', 'accepted', 'approved')
    ) THEN
        RETURN TRUE;
    END IF;

    -- Check payments table (reference_number or receipt_number)
    IF EXISTS (
        SELECT 1 
        FROM public.payments 
        WHERE LOWER(regexp_replace(COALESCE(reference_number, ''), '[^a-zA-Z0-9]', '', 'g')) = cleaned
           OR LOWER(regexp_replace(COALESCE(receipt_number, ''), '[^a-zA-Z0-9]', '', 'g')) = cleaned
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- Grant execute permission to authenticated users & anon
GRANT EXECUTE ON FUNCTION public.check_reference_exists(TEXT) TO authenticated, anon;

-- 2. Trigger function to block duplicate inserts at DB level
CREATE OR REPLACE FUNCTION public.check_duplicate_payment_reference()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ocr_reference IS NOT NULL AND trim(NEW.ocr_reference) != '' THEN
        IF public.check_reference_exists(NEW.ocr_reference) THEN
            RAISE EXCEPTION 'Duplicate receipt detected: Reference number % has already been submitted for a payment.', NEW.ocr_reference;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_payment_reference ON public.payment_submissions;

CREATE TRIGGER trg_prevent_duplicate_payment_reference
    BEFORE INSERT OR UPDATE ON public.payment_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_duplicate_payment_reference();
