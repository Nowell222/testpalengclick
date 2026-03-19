
-- =============================================
-- PALENG-CLICK Complete Database Schema
-- =============================================

-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'cashier', 'vendor');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  contact_number TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- 4. Stalls table
CREATE TABLE public.stalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stall_number TEXT NOT NULL UNIQUE,
  section TEXT NOT NULL DEFAULT 'General',
  location TEXT,
  monthly_rate NUMERIC(10,2) NOT NULL DEFAULT 1450.00,
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('occupied', 'vacant')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Vendors table (links profile to stall)
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stall_id UUID REFERENCES public.stalls(id) ON DELETE SET NULL,
  qr_code TEXT,
  tax_id TEXT,
  award_date DATE,
  documents TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  stall_id UUID REFERENCES public.stalls(id),
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('gcash', 'paymaya', 'instapay', 'cash')),
  payment_type TEXT NOT NULL DEFAULT 'due' CHECK (payment_type IN ('due', 'staggered', 'manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'overdue')),
  reference_number TEXT,
  receipt_number TEXT,
  period_month INT,
  period_year INT,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Payment schedules
CREATE TABLE public.payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  stall_id UUID REFERENCES public.stalls(id),
  due_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'due' CHECK (payment_type IN ('due', 'staggered')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Installments
CREATE TABLE public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.payment_schedules(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  paid_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Announcements
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('reminder', 'confirmation', 'announcement', 'overdue', 'info')),
  read_status BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. SMS Logs
CREATE TABLE public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient TEXT NOT NULL,
  recipient_user_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('reminder', 'confirmation', 'announcement', 'overdue')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  sent_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Enable RLS on all tables
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Security definer function for role checks
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- =============================================
-- RLS Policies
-- =============================================

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete profiles" ON public.profiles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- User roles
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete roles" ON public.user_roles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Stalls
CREATE POLICY "Authenticated users can view stalls" ON public.stalls
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can insert stalls" ON public.stalls
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update stalls" ON public.stalls
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete stalls" ON public.stalls
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Vendors
CREATE POLICY "Vendor sees own, admin/cashier see all" ON public.vendors
  FOR SELECT USING (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'cashier')
  );
CREATE POLICY "Admin can insert vendors" ON public.vendors
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update vendors" ON public.vendors
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete vendors" ON public.vendors
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Payments
CREATE POLICY "View payments" ON public.payments
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cashier')
  );
CREATE POLICY "Insert payments" ON public.payments
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'cashier')
    OR vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  );
CREATE POLICY "Update payments" ON public.payments
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'cashier')
  );

-- Payment schedules
CREATE POLICY "View schedules" ON public.payment_schedules
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cashier')
  );
CREATE POLICY "Admin can manage schedules" ON public.payment_schedules
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update schedules" ON public.payment_schedules
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));

-- Installments
CREATE POLICY "View installments" ON public.installments
  FOR SELECT USING (
    schedule_id IN (
      SELECT ps.id FROM public.payment_schedules ps 
      JOIN public.vendors v ON ps.vendor_id = v.id 
      WHERE v.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cashier')
  );
CREATE POLICY "Manage installments" ON public.installments
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));
CREATE POLICY "Update installments" ON public.installments
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));

-- Announcements
CREATE POLICY "View announcements" ON public.announcements
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin insert announcements" ON public.announcements
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update announcements" ON public.announcements
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete announcements" ON public.announcements
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Notifications
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin/cashier create notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'cashier')
  );
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- SMS logs
CREATE POLICY "Admin/cashier view sms" ON public.sms_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));
CREATE POLICY "Admin/cashier send sms" ON public.sms_logs
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));

-- =============================================
-- Triggers
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stalls_updated_at BEFORE UPDATE ON public.stalls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate QR code on vendor creation
CREATE OR REPLACE FUNCTION public.generate_vendor_qr_code()
RETURNS TRIGGER AS $$
DECLARE
  stall_num TEXT;
BEGIN
  IF NEW.stall_id IS NOT NULL THEN
    SELECT stall_number INTO stall_num FROM public.stalls WHERE id = NEW.stall_id;
    NEW.qr_code := 'PALENGCLICK-' || COALESCE(stall_num, 'NOSTALL') || '-' || NEW.id::text;
  ELSE
    NEW.qr_code := 'PALENGCLICK-NOSTALL-' || NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER auto_generate_qr_code
  BEFORE INSERT ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_vendor_qr_code();

-- Auto-generate payment reference numbers
CREATE SEQUENCE IF NOT EXISTS payment_ref_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_payment_reference()
RETURNS TRIGGER AS $$
BEGIN
  NEW.reference_number := 'PC-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(nextval('payment_ref_seq')::text, 5, '0');
  NEW.receipt_number := 'RC-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(currval('payment_ref_seq')::text, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER auto_generate_payment_ref
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_payment_reference();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Dashboard data function
CREATE OR REPLACE FUNCTION public.get_vendor_dashboard_data(_user_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'vendor', (
      SELECT json_build_object(
        'id', v.id,
        'qr_code', v.qr_code,
        'stall_number', s.stall_number,
        'section', s.section,
        'location', s.location,
        'monthly_rate', s.monthly_rate,
        'award_date', v.award_date
      )
      FROM vendors v
      LEFT JOIN stalls s ON v.stall_id = s.id
      WHERE v.user_id = _user_id
    ),
    'profile', (
      SELECT json_build_object(
        'first_name', p.first_name,
        'middle_name', p.middle_name,
        'last_name', p.last_name,
        'contact_number', p.contact_number
      )
      FROM profiles p WHERE p.user_id = _user_id
    )
  )
$$;

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_payments_vendor_id ON public.payments(vendor_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_created_at ON public.payments(created_at);
CREATE INDEX idx_vendors_user_id ON public.vendors(user_id);
CREATE INDEX idx_vendors_stall_id ON public.vendors(stall_id);
CREATE INDEX idx_payment_schedules_vendor ON public.payment_schedules(vendor_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_sms_logs_sent_at ON public.sms_logs(sent_at);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
