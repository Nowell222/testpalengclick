-- Migration: Allow vendors to update their own stall area
-- This creates a security definer function so vendors can bypass the "Admin only" update policy on stalls table.

CREATE OR REPLACE FUNCTION update_stall_area(p_stall_id UUID, p_area_measurement TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify that the currently authenticated user is the vendor assigned to this stall
  IF EXISTS (
    SELECT 1 FROM vendors 
    WHERE vendors.stall_id = p_stall_id 
    AND vendors.user_id = auth.uid()
  ) THEN
    UPDATE stalls SET area_measurement = p_area_measurement WHERE id = p_stall_id;
  ELSE
    RAISE EXCEPTION 'Not authorized to update this stall. You must be the assigned vendor.';
  END IF;
END;
$$;
