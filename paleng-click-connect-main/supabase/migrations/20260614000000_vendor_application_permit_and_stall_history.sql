-- 1. Add verification fields to public.vendor_applications
ALTER TABLE public.vendor_applications
  ADD COLUMN IF NOT EXISTS business_permit_number TEXT,
  ADD COLUMN IF NOT EXISTS award_receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS award_payment_date DATE;

-- 2. Create public.stall_ownership_history table
CREATE TABLE IF NOT EXISTS public.stall_ownership_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stall_id UUID NOT NULL REFERENCES public.stalls(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'transferred'))
);

-- Enable RLS
ALTER TABLE public.stall_ownership_history ENABLE ROW LEVEL SECURITY;

-- 3. Create select policy for BPLO and Admin
DROP POLICY IF EXISTS "Admin/BPLO can view stall history" ON public.stall_ownership_history;
CREATE POLICY "Admin/BPLO can view stall history" ON public.stall_ownership_history
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'bplo')
  );

-- 4. Create trigger function to manage stall ownership history and transfer records
CREATE OR REPLACE FUNCTION public.handle_vendor_stall_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_old_vendor_id UUID;
  v_old_user_id UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.stall_id IS NOT NULL THEN
    -- End any existing active ownership history for this stall
    UPDATE public.stall_ownership_history
    SET ended_at = now(), status = 'closed'
    WHERE stall_id = NEW.stall_id AND ended_at IS NULL AND vendor_id != NEW.id;

    -- Find the most recently closed vendor of this stall
    SELECT vendor_id INTO v_old_vendor_id
    FROM public.stall_ownership_history
    WHERE stall_id = NEW.stall_id AND vendor_id != NEW.id
    ORDER BY started_at DESC
    LIMIT 1;

    -- Create new history record
    INSERT INTO public.stall_ownership_history (stall_id, vendor_id, started_at, status)
    VALUES (NEW.stall_id, NEW.id, now(), 'active');

    -- Transfer payment history if found
    IF v_old_vendor_id IS NOT NULL THEN
      SELECT user_id INTO v_old_user_id FROM public.vendors WHERE id = v_old_vendor_id;

      -- Update payments
      UPDATE public.payments 
      SET vendor_id = NEW.id 
      WHERE vendor_id = v_old_vendor_id AND (stall_id = NEW.stall_id OR stall_id IS NULL);

      -- Update schedules
      UPDATE public.payment_schedules 
      SET vendor_id = NEW.id 
      WHERE vendor_id = v_old_vendor_id AND (stall_id = NEW.stall_id OR stall_id IS NULL);

      -- Update submissions
      UPDATE public.payment_submissions 
      SET vendor_id = NEW.id, vendor_user_id = NEW.user_id
      WHERE vendor_id = v_old_vendor_id AND (stall_id = NEW.stall_id OR stall_id IS NULL);

      -- Mark old history record as transferred
      UPDATE public.stall_ownership_history
      SET status = 'transferred'
      WHERE stall_id = NEW.stall_id AND vendor_id = v_old_vendor_id AND ended_at IS NOT NULL;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- If stall changed
    IF OLD.stall_id IS DISTINCT FROM NEW.stall_id THEN
      -- Close old stall history if it was active
      IF OLD.stall_id IS NOT NULL THEN
        UPDATE public.stall_ownership_history
        SET ended_at = now(), status = 'closed'
        WHERE stall_id = OLD.stall_id AND vendor_id = NEW.id AND ended_at IS NULL;
      END IF;

      -- Start new stall history if not null
      IF NEW.stall_id IS NOT NULL THEN
        -- Close any active ownership history of the new stall for others
        UPDATE public.stall_ownership_history
        SET ended_at = now(), status = 'closed'
        WHERE stall_id = NEW.stall_id AND ended_at IS NULL AND vendor_id != NEW.id;

        -- Find the most recently closed vendor of the new stall
        SELECT vendor_id INTO v_old_vendor_id
        FROM public.stall_ownership_history
        WHERE stall_id = NEW.stall_id AND vendor_id != NEW.id
        ORDER BY started_at DESC
        LIMIT 1;

        -- Create new history
        INSERT INTO public.stall_ownership_history (stall_id, vendor_id, started_at, status)
        VALUES (NEW.stall_id, NEW.id, now(), 'active');

        -- Transfer history
        IF v_old_vendor_id IS NOT NULL THEN
          SELECT user_id INTO v_old_user_id FROM public.vendors WHERE id = v_old_vendor_id;

          -- Update payments
          UPDATE public.payments 
          SET vendor_id = NEW.id 
          WHERE vendor_id = v_old_vendor_id AND (stall_id = NEW.stall_id OR stall_id IS NULL);

          -- Update schedules
          UPDATE public.payment_schedules 
          SET vendor_id = NEW.id 
          WHERE vendor_id = v_old_vendor_id AND (stall_id = NEW.stall_id OR stall_id IS NULL);

          -- Update submissions
          UPDATE public.payment_submissions 
          SET vendor_id = NEW.id, vendor_user_id = NEW.user_id
          WHERE vendor_id = v_old_vendor_id AND (stall_id = NEW.stall_id OR stall_id IS NULL);

          -- Mark old history as transferred
          UPDATE public.stall_ownership_history
          SET status = 'transferred'
          WHERE stall_id = NEW.stall_id AND vendor_id = v_old_vendor_id AND ended_at IS NOT NULL;
        END IF;
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' AND OLD.stall_id IS NOT NULL THEN
    -- Close active ownership history for this stall
    UPDATE public.stall_ownership_history
    SET ended_at = now(), status = 'closed'
    WHERE stall_id = OLD.stall_id AND vendor_id = OLD.id AND ended_at IS NULL;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bind trigger to public.vendors
DROP TRIGGER IF EXISTS trg_handle_vendor_stall_assignment ON public.vendors;
CREATE TRIGGER trg_handle_vendor_stall_assignment
  AFTER INSERT OR UPDATE OR DELETE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_vendor_stall_assignment();

-- 5. Pre-populate history for currently active vendors with stalls
INSERT INTO public.stall_ownership_history (stall_id, vendor_id, started_at, status)
SELECT stall_id, id, COALESCE(award_date::timestamptz, created_at, now()), 'active'
FROM public.vendors
WHERE stall_id IS NOT NULL
ON CONFLICT DO NOTHING;
