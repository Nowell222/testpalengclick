-- =============================================
-- Feature Expansion Migration
-- 1. Audit Logging
-- 2. Cashier Shifts
-- 3. Automated Penalties
-- 4. Vendor Applications
-- =============================================

-- =============================================
-- 1. Audit Logging
-- =============================================
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view audit logs" ON public.audit_logs
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Trigger function for audit logging
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    old_json JSONB;
    new_json JSONB;
    record_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        new_json := to_jsonb(NEW);
        record_id := NEW.id;
    ELSIF TG_OP = 'UPDATE' THEN
        old_json := to_jsonb(OLD);
        new_json := to_jsonb(NEW);
        record_id := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        old_json := to_jsonb(OLD);
        record_id := OLD.id;
    END IF;

    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, record_id, old_json, new_json);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to critical tables
CREATE TRIGGER audit_payments
    AFTER INSERT OR UPDATE OR DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_stalls
    AFTER INSERT OR UPDATE OR DELETE ON public.stalls
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_vendors
    AFTER INSERT OR UPDATE OR DELETE ON public.vendors
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_payment_schedules
    AFTER INSERT OR UPDATE OR DELETE ON public.payment_schedules
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


-- =============================================
-- 2. Cashier Shifts
-- =============================================
CREATE TABLE public.cashier_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cashier_id UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    starting_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
    actual_ending_cash NUMERIC(10,2),
    system_computed_cash NUMERIC(10,2),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    notes TEXT
);

ALTER TABLE public.cashier_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cashier view own shifts, Admin view all" ON public.cashier_shifts
    FOR SELECT USING (auth.uid() = cashier_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Cashier manage own shifts" ON public.cashier_shifts
    FOR INSERT WITH CHECK (auth.uid() = cashier_id AND public.has_role(auth.uid(), 'cashier'));
CREATE POLICY "Cashier update own shifts" ON public.cashier_shifts
    FOR UPDATE USING (auth.uid() = cashier_id AND public.has_role(auth.uid(), 'cashier'));

-- Update Payments table to include shift_id
ALTER TABLE public.payments ADD COLUMN shift_id UUID REFERENCES public.cashier_shifts(id);
CREATE INDEX idx_payments_shift_id ON public.payments(shift_id);


-- =============================================
-- 3. Automated Penalties
-- =============================================
ALTER TABLE public.payment_schedules ADD COLUMN penalty_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payment_schedules ADD COLUMN penalty_applied_at TIMESTAMPTZ;


-- =============================================
-- 4. Vendor Applications
-- =============================================
CREATE TABLE public.vendor_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_user_id UUID REFERENCES auth.users(id),
    business_name TEXT NOT NULL,
    preferred_section TEXT,
    documents JSONB, -- Array of URLs or metadata
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
    admin_notes TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicant view own app, Admin view all" ON public.vendor_applications
    FOR SELECT USING (auth.uid() = applicant_user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can insert app" ON public.vendor_applications
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage apps" ON public.vendor_applications
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_vendor_applications_updated_at 
    BEFORE UPDATE ON public.vendor_applications 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
