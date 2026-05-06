-- =============================================
-- Security Hardening Migration
-- Ensures all tables have RLS enabled and basic policies
-- =============================================

-- 1. Enable RLS on remaining tables
ALTER TABLE IF EXISTS public.payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stall_fee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

-- 2. Basic Policies for payment_submissions
DROP POLICY IF EXISTS "Users can view own submissions" ON public.payment_submissions;
CREATE POLICY "Users can view own submissions" ON public.payment_submissions
    FOR SELECT USING (auth.uid() = vendor_user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can insert own submissions" ON public.payment_submissions;
CREATE POLICY "Users can insert own submissions" ON public.payment_submissions
    FOR INSERT WITH CHECK (auth.uid() = vendor_user_id);

-- 3. Basic Policies for vendor_documents
DROP POLICY IF EXISTS "Users can view own documents" ON public.vendor_documents;
CREATE POLICY "Users can view own documents" ON public.vendor_documents
    FOR SELECT USING (
        vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

-- 4. Basic Policies for push_subscriptions
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own subscriptions" ON public.push_subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- 5. Basic Policies for stall_fee_schedules
DROP POLICY IF EXISTS "Authenticated users can view fee schedules" ON public.stall_fee_schedules;
CREATE POLICY "Authenticated users can view fee schedules" ON public.stall_fee_schedules
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin can manage fee schedules" ON public.stall_fee_schedules;
CREATE POLICY "Admin can manage fee schedules" ON public.stall_fee_schedules
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));
