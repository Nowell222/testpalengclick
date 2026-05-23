-- Migration: Add EEMO role SELECT policies for all tables

-- 1. Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'cashier') 
    OR public.has_role(auth.uid(), 'bplo') 
    OR public.has_role(auth.uid(), 'eemo')
  );

-- 2. User Roles
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'eemo')
  );

-- 3. Vendors
DROP POLICY IF EXISTS "Vendor sees own, admin/bplo/cashier see all" ON public.vendors;
CREATE POLICY "Vendor sees own, admin/bplo/cashier see all" ON public.vendors
  FOR SELECT USING (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'cashier')
    OR public.has_role(auth.uid(), 'bplo')
    OR public.has_role(auth.uid(), 'eemo')
  );

-- 4. Payments
DROP POLICY IF EXISTS "View payments" ON public.payments;
CREATE POLICY "View payments" ON public.payments
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cashier')
    OR public.has_role(auth.uid(), 'eemo')
  );

-- 5. Payment Schedules
DROP POLICY IF EXISTS "View schedules" ON public.payment_schedules;
CREATE POLICY "View schedules" ON public.payment_schedules
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cashier')
    OR public.has_role(auth.uid(), 'eemo')
  );

-- 6. Installments
DROP POLICY IF EXISTS "View installments" ON public.installments;
CREATE POLICY "View installments" ON public.installments
  FOR SELECT USING (
    schedule_id IN (
      SELECT ps.id FROM public.payment_schedules ps 
      JOIN public.vendors v ON ps.vendor_id = v.id 
      WHERE v.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cashier')
    OR public.has_role(auth.uid(), 'eemo')
  );

-- 7. SMS Logs
DROP POLICY IF EXISTS "Admin/cashier view sms" ON public.sms_logs;
CREATE POLICY "Admin/cashier view sms" ON public.sms_logs
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'cashier') 
    OR public.has_role(auth.uid(), 'eemo')
  );

-- 8. Audit Logs
DROP POLICY IF EXISTS "Admin view audit logs" ON public.audit_logs;
CREATE POLICY "Admin view audit logs" ON public.audit_logs
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'eemo')
  );

-- 9. Cashier Shifts
DROP POLICY IF EXISTS "Cashier view own shifts, Admin view all" ON public.cashier_shifts;
CREATE POLICY "Cashier view own shifts, Admin view all" ON public.cashier_shifts
  FOR SELECT USING (
    auth.uid() = cashier_id 
    OR public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'eemo')
  );

-- 10. Vendor Applications
DROP POLICY IF EXISTS "Admin view all" ON public.vendor_applications;
CREATE POLICY "Admin view all" ON public.vendor_applications
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'eemo')
  );

-- 11. Message Threads
DROP POLICY IF EXISTS "Users view own threads" ON public.message_threads;
CREATE POLICY "Users view own threads" ON public.message_threads
  FOR SELECT USING (
    auth.uid() = vendor_id 
    OR auth.uid() = admin_id 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'eemo')
  );

-- 12. Messages
DROP POLICY IF EXISTS "Users view own messages" ON public.messages;
CREATE POLICY "Users view own messages" ON public.messages
  FOR SELECT USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cashier')
    OR public.has_role(auth.uid(), 'eemo')
  );

-- 13. Payment Submissions
DROP POLICY IF EXISTS "Users can view own submissions" ON public.payment_submissions;
CREATE POLICY "Users can view own submissions" ON public.payment_submissions
  FOR SELECT USING (
    auth.uid() = vendor_user_id 
    OR public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'eemo')
  );

-- 14. Vendor Documents
DROP POLICY IF EXISTS "Users can view own documents" ON public.vendor_documents;
CREATE POLICY "Users can view own documents" ON public.vendor_documents
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'eemo')
  );
