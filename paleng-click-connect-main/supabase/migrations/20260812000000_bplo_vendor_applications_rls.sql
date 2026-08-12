-- Migration: Add BPLO SELECT and UPDATE policies for vendor_applications
DROP POLICY IF EXISTS "Admin view all" ON public.vendor_applications;
CREATE POLICY "Admin view all" ON public.vendor_applications
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'bplo')
    OR public.has_role(auth.uid(), 'eemo')
  );

DROP POLICY IF EXISTS "Admin manage apps" ON public.vendor_applications;
CREATE POLICY "Admin manage apps" ON public.vendor_applications
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'bplo')
  );
