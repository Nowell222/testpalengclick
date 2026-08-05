-- Migration: Allow Admin, BPLO, EEMO, and Vendor to view stall ownership history

DROP POLICY IF EXISTS "Admin/BPLO can view stall history" ON public.stall_ownership_history;
DROP POLICY IF EXISTS "Admin/BPLO/EEMO/Vendor can view stall history" ON public.stall_ownership_history;

CREATE POLICY "Admin/BPLO/EEMO/Vendor can view stall history" ON public.stall_ownership_history
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'bplo')
    OR public.has_role(auth.uid(), 'eemo')
    OR public.has_role(auth.uid(), 'vendor')
  );
