-- Migration: Bypass vendor application rate limiting for Admin and BPLO roles
CREATE OR REPLACE FUNCTION public.check_vendor_application_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
    -- Bypass rate limiting if submitted by Admin or BPLO staff
    IF auth.uid() IS NOT NULL AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'bplo')) THEN
        RETURN NEW;
    END IF;

    -- For public applicants, limit submissions to 1 per hour per email/phone
    IF EXISTS (
        SELECT 1 
        FROM public.vendor_applications 
        WHERE (email = NEW.email OR (phone_number IS NOT NULL AND phone_number != '' AND phone_number = NEW.phone_number))
        AND (application_date > (now() - interval '1 hour') OR applied_at > (now() - interval '1 hour'))
    ) THEN
        RAISE EXCEPTION 'Too many application attempts. Please wait 1 hour before trying again with this email/phone.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
