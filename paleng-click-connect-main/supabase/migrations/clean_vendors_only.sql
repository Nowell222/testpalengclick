-- ==============================================================================
-- SCRIPT: CLEAN ALL VENDOR & STALL DATA (STAFF ACCOUNTS PRESERVED)
-- 
-- Description:
--   Removes all vendors, vendor accounts, applications, payments, documents,
--   histories, and stalls. The ONLY records that remain are non-vendor staff 
--   accounts (Admin, BPLO, Cashier, EEMO).
-- ==============================================================================

DO $$
DECLARE
  v_vendor_user_ids UUID[];
BEGIN
  -- 1. Collect all user IDs associated with the Vendor role, vendor profiles, or applications
  SELECT ARRAY_AGG(DISTINCT u_id) INTO v_vendor_user_ids
  FROM (
    SELECT user_id AS u_id FROM public.user_roles WHERE role = 'vendor'
    UNION
    SELECT user_id AS u_id FROM public.vendors WHERE user_id IS NOT NULL
    UNION
    SELECT applicant_user_id AS u_id FROM public.vendor_applications WHERE applicant_user_id IS NOT NULL
  ) sub;

  -- 2. Clear all vendor-related transactional data, payments, and histories
  DELETE FROM public.stall_ownership_history;
  DELETE FROM public.vendor_documents;
  DELETE FROM public.payment_submissions;
  DELETE FROM public.installments;
  DELETE FROM public.payment_schedules;
  DELETE FROM public.payments;
  DELETE FROM public.vendor_applications;
  DELETE FROM public.cashier_shifts;

  -- 3. Delete vendor user entries and communications
  IF v_vendor_user_ids IS NOT NULL AND array_length(v_vendor_user_ids, 1) > 0 THEN
    DELETE FROM public.messages WHERE sender_id = ANY(v_vendor_user_ids) OR recipient_id = ANY(v_vendor_user_ids);
    DELETE FROM public.notifications WHERE user_id = ANY(v_vendor_user_ids);
    DELETE FROM public.push_subscriptions WHERE user_id = ANY(v_vendor_user_ids);
    
    -- Delete vendors table
    DELETE FROM public.vendors;
    
    -- Delete user_roles, profiles, and auth.users for vendors ONLY
    DELETE FROM public.user_roles WHERE user_id = ANY(v_vendor_user_ids);
    DELETE FROM public.profiles WHERE user_id = ANY(v_vendor_user_ids);
    DELETE FROM auth.users WHERE id = ANY(v_vendor_user_ids);
  ELSE
    DELETE FROM public.vendors;
  END IF;

  -- 4. Delete stall fee schedules and stalls
  DELETE FROM public.stall_fee_schedules;
  DELETE FROM public.stalls;

END $$;
