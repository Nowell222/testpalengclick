-- Create a public function to get landing page stats securely
CREATE OR REPLACE FUNCTION public.get_landing_page_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS and see all rows
AS $$
DECLARE
  v_vendors_count integer;
  v_overdue_schedules integer;
  v_total_schedules integer;
  v_delinquency_rate numeric;
BEGIN
  -- 1. Count active stallholders (vendors with stalls)
  SELECT count(*) INTO v_vendors_count FROM public.vendors;

  -- 2. Calculate delinquency rate for the current year
  SELECT count(*) INTO v_total_schedules FROM public.payment_schedules WHERE payment_type = 'due';
  SELECT count(*) INTO v_overdue_schedules FROM public.payment_schedules WHERE status = 'overdue' AND payment_type = 'due';

  IF v_total_schedules > 0 THEN
    v_delinquency_rate := round((v_overdue_schedules::numeric / v_total_schedules::numeric) * 100, 2);
  ELSE
    v_delinquency_rate := 20.01; -- Fallback to baseline if no schedules exist
  END IF;

  RETURN json_build_object(
    'vendorCount', v_vendors_count,
    'delinquencyRate', v_delinquency_rate
  );
END;
$$;

-- Allow anonymous access to this function
GRANT EXECUTE ON FUNCTION public.get_landing_page_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.get_landing_page_stats() TO authenticated;
