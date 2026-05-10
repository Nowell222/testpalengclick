
-- Function to handle vendor deletion and auto-vacate stalls
CREATE OR REPLACE FUNCTION public.handle_vendor_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- If the vendor being deleted has a stall, mark it as vacant
  IF OLD.stall_id IS NOT NULL THEN
    UPDATE public.stalls
    SET status = 'vacant',
        updated_at = now()
    WHERE id = OLD.stall_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to execute the function after a vendor record is deleted
-- This works even if the vendor is deleted via CASCADE from auth.users
DROP TRIGGER IF EXISTS on_vendor_deleted ON public.vendors;
CREATE TRIGGER on_vendor_deleted
  AFTER DELETE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_vendor_deletion();
