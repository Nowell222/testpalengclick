-- 1. Alter profiles status check constraint to include 'delinquent' and 'closed'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'suspended', 'delinquent', 'closed'));

-- 2. Add closure and transfer columns to vendors table
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closure_reason TEXT,
  ADD COLUMN IF NOT EXISTS closure_notes TEXT,
  ADD COLUMN IF NOT EXISTS transferred_to_vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
