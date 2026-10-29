-- Migration: Allow public/anon viewing of stall availability and provide an RPC to get occupied stalls
-- File: 20260911000000_get_occupied_stalls.sql

-- 1. Create a public function to get all occupied stall numbers securely
CREATE OR REPLACE FUNCTION public.get_occupied_stalls()
RETURNS TABLE (stall_number text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.stall_number
  FROM public.stalls s
  WHERE s.status = 'occupied'
  UNION
  -- Also include stalls assigned to active vendors
  SELECT s2.stall_number
  FROM public.vendors v
  JOIN public.stalls s2 ON v.stall_id = s2.id
  JOIN public.profiles p ON v.user_id = p.user_id
  WHERE p.status != 'closed';
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_occupied_stalls() TO anon;
GRANT EXECUTE ON FUNCTION public.get_occupied_stalls() TO authenticated;

-- 2. Ensure anyone (including prospective vendors applying online) can view stalls table availability
DROP POLICY IF EXISTS "Anyone can view stalls" ON public.stalls;
CREATE POLICY "Anyone can view stalls" ON public.stalls
  FOR SELECT USING (true);
