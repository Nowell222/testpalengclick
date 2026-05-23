-- Migration: Transfer fee schedule management to cashier and restrict cashier to only update monthly_rate on stalls

-- 1. Update stall_fee_schedules write policies
DROP POLICY IF EXISTS "Admin can manage fee schedules" ON public.stall_fee_schedules;
CREATE POLICY "Cashier can manage fee schedules" ON public.stall_fee_schedules
    FOR ALL USING (public.has_role(auth.uid(), 'cashier'));

-- 2. Update stalls update policy to allow Cashier (along with Admin/BPLO)
DROP POLICY IF EXISTS "Admin/BPLO can update stalls" ON public.stalls;
CREATE POLICY "Admin/BPLO/Cashier can update stalls" ON public.stalls
    FOR UPDATE USING (
        public.has_role(auth.uid(), 'bplo') 
        OR public.has_role(auth.uid(), 'admin') 
        OR public.has_role(auth.uid(), 'cashier')
    );

-- 3. Restrict Cashier to only modify 'monthly_rate' when updating stalls
CREATE OR REPLACE FUNCTION public.check_stall_update_permissions()
RETURNS TRIGGER AS $$
BEGIN
  IF public.has_role(auth.uid(), 'cashier') THEN
    -- Restrict update to ONLY the monthly_rate column
    IF (OLD.id IS DISTINCT FROM NEW.id OR
        OLD.stall_number IS DISTINCT FROM NEW.stall_number OR
        OLD.section IS DISTINCT FROM NEW.section OR
        OLD.location IS DISTINCT FROM NEW.location OR
        OLD.status IS DISTINCT FROM NEW.status OR
        OLD.created_at IS DISTINCT FROM NEW.created_at) THEN
      RAISE EXCEPTION 'Cashier is only authorized to update the monthly_rate of a stall.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_restrict_stall_updates ON public.stalls;
CREATE TRIGGER trg_restrict_stall_updates
  BEFORE UPDATE ON public.stalls
  FOR EACH ROW
  EXECUTE FUNCTION public.check_stall_update_permissions();
