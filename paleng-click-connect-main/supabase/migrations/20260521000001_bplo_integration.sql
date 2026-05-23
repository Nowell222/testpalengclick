-- Migration: Add vendor licensing columns and configure BPLO policies/triggers
-- Note: 'bplo' enum value was committed in the previous migration.

-- 1. Add licensing columns to public.vendors
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS business_permit_number TEXT,
ADD COLUMN IF NOT EXISTS award_receipt_number TEXT,
ADD COLUMN IF NOT EXISTS award_payment_date DATE;

-- 2. Restrict update_stall_area RPC to admin and bplo only
CREATE OR REPLACE FUNCTION public.update_stall_area(p_stall_id UUID, p_area_measurement TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify that the currently authenticated user is admin or bplo
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'bplo') THEN
    UPDATE public.stalls SET area_measurement = p_area_measurement WHERE id = p_stall_id;
  ELSE
    RAISE EXCEPTION 'Not authorized to update stall area. Only BPLO and Admin can edit this.';
  END IF;
END;
$$;

-- 3. Create trigger function to prevent vendors from updating their first_name, middle_name, and last_name
CREATE OR REPLACE FUNCTION public.check_vendor_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If updater is a vendor, they cannot change first_name, middle_name, last_name
  IF public.has_role(auth.uid(), 'vendor') THEN
    IF NEW.first_name IS DISTINCT FROM OLD.first_name OR
       NEW.middle_name IS DISTINCT FROM OLD.middle_name OR
       NEW.last_name IS DISTINCT FROM OLD.last_name THEN
      RAISE EXCEPTION 'Vendors are not allowed to update their first name, middle name, or last name.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_restrict_vendor_profile_updates ON public.profiles;
CREATE TRIGGER trg_restrict_vendor_profile_updates
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_vendor_profile_update();

-- 4. Update RLS policies to grant access to BPLO role
-- Profiles policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'bplo'));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier') OR public.has_role(auth.uid(), 'bplo'));

-- Vendors policy
DROP POLICY IF EXISTS "Vendor sees own, admin/cashier see all" ON public.vendors;
CREATE POLICY "Vendor sees own, admin/bplo/cashier see all" ON public.vendors
  FOR SELECT USING (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'cashier')
    OR public.has_role(auth.uid(), 'bplo')
  );

DROP POLICY IF EXISTS "BPLO/Admin can update vendors" ON public.vendors;
CREATE POLICY "BPLO/Admin can update vendors" ON public.vendors
  FOR UPDATE USING (public.has_role(auth.uid(), 'bplo') OR public.has_role(auth.uid(), 'admin'));

-- Stalls policy
DROP POLICY IF EXISTS "Admin/BPLO can update stalls" ON public.stalls;
CREATE POLICY "Admin/BPLO can update stalls" ON public.stalls
  FOR UPDATE USING (public.has_role(auth.uid(), 'bplo') OR public.has_role(auth.uid(), 'admin'));
