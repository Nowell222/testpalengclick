-- =============================================
-- Fix Vendor Applications RLS Policy
-- =============================================
-- Drop existing policies that may be causing issues
DROP POLICY IF EXISTS "Applicant view own app, Admin view all" ON public.vendor_applications;
DROP POLICY IF EXISTS "Anyone can insert app" ON public.vendor_applications;
DROP POLICY IF EXISTS "Admin manage apps" ON public.vendor_applications;

-- Create new simplified policies
-- Allow anyone to insert applications
CREATE POLICY "Anyone can insert app" ON public.vendor_applications
    FOR INSERT WITH CHECK (true);

-- Allow admin to view all applications
CREATE POLICY "Admin view all" ON public.vendor_applications
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Allow applicant to view own application (if applicant_user_id is set)
CREATE POLICY "Applicant view own app" ON public.vendor_applications
    FOR SELECT USING (auth.uid() = applicant_user_id AND applicant_user_id IS NOT NULL);

-- Allow admin to update applications
CREATE POLICY "Admin manage apps" ON public.vendor_applications
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Allow admin to delete applications
CREATE POLICY "Admin delete apps" ON public.vendor_applications
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
