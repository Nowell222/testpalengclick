-- Migration: SECURITY DEFINER RPC function to fetch complete stall ownership history with profile names
-- Bypasses RLS restrictions so vendors can view past stall owner names on their stall history timeline.

CREATE OR REPLACE FUNCTION public.get_stall_ownership_history_details(p_stall_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'stall_id', h.stall_id,
        'vendor_id', h.vendor_id,
        'started_at', h.started_at,
        'ended_at', h.ended_at,
        'status', h.status,
        'vendors', CASE WHEN v.id IS NOT NULL THEN jsonb_build_object(
          'id', v.id,
          'user_id', v.user_id,
          'business_permit_number', v.business_permit_number,
          'award_receipt_number', v.award_receipt_number,
          'award_payment_date', v.award_payment_date,
          'award_date', v.award_date,
          'qr_code', v.qr_code,
          'closed_at', v.closed_at,
          'closure_reason', v.closure_reason,
          'closure_notes', v.closure_notes,
          'profiles', CASE WHEN p.user_id IS NOT NULL THEN jsonb_build_object(
            'user_id', p.user_id,
            'first_name', p.first_name,
            'middle_name', p.middle_name,
            'last_name', p.last_name,
            'contact_number', p.contact_number,
            'address', p.address,
            'status', p.status
          ) ELSE NULL END,
          'last_payment_date', (
            SELECT MAX(created_at) FROM public.payments WHERE vendor_id = v.id AND status = 'completed'
          )
        ) ELSE NULL END
      )
      ORDER BY 
        CASE WHEN h.ended_at IS NULL AND h.status = 'active' THEN 1 ELSE 2 END,
        h.started_at DESC
    ),
    '[]'::jsonb
  ) INTO v_result
  FROM public.stall_ownership_history h
  LEFT JOIN public.vendors v ON h.vendor_id = v.id
  LEFT JOIN public.profiles p ON v.user_id = p.user_id
  WHERE h.stall_id = p_stall_id;

  -- Fallback: If stall_ownership_history has no records, query vendors directly
  IF v_result IS NULL OR jsonb_array_length(v_result) = 0 THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', 'hist-direct-' || v.id,
          'stall_id', p_stall_id,
          'vendor_id', v.id,
          'started_at', COALESCE(v.award_date, v.created_at, now()),
          'ended_at', v.closed_at,
          'status', CASE WHEN v.closed_at IS NOT NULL THEN 'closed' ELSE 'active' END,
          'vendors', jsonb_build_object(
            'id', v.id,
            'user_id', v.user_id,
            'business_permit_number', v.business_permit_number,
            'award_receipt_number', v.award_receipt_number,
            'award_payment_date', v.award_payment_date,
            'award_date', v.award_date,
            'qr_code', v.qr_code,
            'closed_at', v.closed_at,
            'closure_reason', v.closure_reason,
            'closure_notes', v.closure_notes,
            'profiles', CASE WHEN p.user_id IS NOT NULL THEN jsonb_build_object(
              'user_id', p.user_id,
              'first_name', p.first_name,
              'middle_name', p.middle_name,
              'last_name', p.last_name,
              'contact_number', p.contact_number,
              'address', p.address,
              'status', p.status
            ) ELSE NULL END,
            'last_payment_date', (
              SELECT MAX(created_at) FROM public.payments WHERE vendor_id = v.id AND status = 'completed'
            )
          )
        )
        ORDER BY 
          CASE WHEN v.closed_at IS NULL THEN 1 ELSE 2 END,
          COALESCE(v.award_date, v.created_at) DESC
      ),
      '[]'::jsonb
    ) INTO v_result
    FROM public.vendors v
    LEFT JOIN public.profiles p ON v.user_id = p.user_id
    WHERE v.stall_id = p_stall_id;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stall_ownership_history_details(UUID) TO authenticated, anon;
