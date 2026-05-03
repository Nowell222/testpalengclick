-- =============================================
-- Add Missing Message_Threads Table
-- =============================================
-- This table is referenced in AdminNews.tsx and vendor pages but was missing from migrations

CREATE TABLE IF NOT EXISTS public.message_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(vendor_id, admin_id)
);

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

-- Admin and vendor can view threads they're part of
CREATE POLICY "Users view own threads" ON public.message_threads
    FOR SELECT USING (
        auth.uid() = vendor_id 
        OR auth.uid() = admin_id 
        OR public.has_role(auth.uid(), 'admin')
    );

-- Admins can create threads
CREATE POLICY "Admin create threads" ON public.message_threads
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can update thread last_at
CREATE POLICY "Admin update threads" ON public.message_threads
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = vendor_id);

CREATE INDEX IF NOT EXISTS idx_message_threads_vendor_id ON public.message_threads(vendor_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_admin_id ON public.message_threads(admin_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_at ON public.message_threads(last_at DESC);

-- Update trigger for updated_at
CREATE TRIGGER update_message_threads_updated_at 
    BEFORE UPDATE ON public.message_threads 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
