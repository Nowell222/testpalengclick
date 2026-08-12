-- Migration: Update get_stall_ownership_history_details RPC function to trace transferred vendor history
-- Allows vendors and admin to view complete ownership history including transferred/closed accounts.

CREATE OR REPLACE FUNCTION public.get_stall_ownership_history_details(
  p_stall_id UUID DEFAULT NULL,
  p_vendor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_vendor_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- 1. Gather all related vendor IDs (direct stall vendors + transferred chain)
  IF p_vendor_id IS NOT NULL THEN
    v_vendor_ids := v_vendor_ids || p_vendor_id;
  END IF;

  IF p_stall_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO v_vendor_ids
    FROM (
      SELECT id FROM public.vendors WHERE stall_id = p_stall_id
      UNION
      SELECT unnest(v_vendor_ids)
    ) t;
  END IF;

  -- Recursively include transferred vendors
  IF array_length(v_vendor_ids, 1) > 0 THEN
    WITH RECURSIVE transfer_chain AS (
      SELECT id, user_id, transferred_to_vendor_id
      FROM public.vendors
      WHERE id = ANY(v_vendor_ids) OR transferred_to_vendor_id = ANY(v_vendor_ids)
      
      UNION
      
      SELECT v.id, v.user_id, v.transferred_to_vendor_id
      FROM public.vendors v
      INNER JOIN transfer_chain tc ON v.transferred_to_vendor_id = tc.id OR v.id = tc.transferred_to_vendor_id
    )
    SELECT ARRAY_AGG(DISTINCT id) INTO v_vendor_ids FROM transfer_chain;
  END IF;

  -- 2. Query stall_ownership_history including transferred vendors
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
          'transferred_to_vendor_id', v.transferred_to_vendor_id,
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
  WHERE (p_stall_id IS NOT NULL AND h.stall_id = p_stall_id)
     OR (v_vendor_ids IS NOT NULL AND h.vendor_id = ANY(v_vendor_ids));

  -- 3. Fallback: If stall_ownership_history has no records, query vendors directly
  IF v_result IS NULL OR jsonb_array_length(v_result) = 0 THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', 'hist-direct-' || v.id,
          'stall_id', COALESCE(v.stall_id, p_stall_id),
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
            'transferred_to_vendor_id', v.transferred_to_vendor_id,
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
    WHERE (p_stall_id IS NOT NULL AND v.stall_id = p_stall_id)
       OR (v_vendor_ids IS NOT NULL AND v.id = ANY(v_vendor_ids));
  END IF;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stall_ownership_history_details(UUID, UUID) TO authenticated, anon;
