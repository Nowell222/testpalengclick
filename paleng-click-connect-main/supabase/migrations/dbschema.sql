create table public.announcements (
  id uuid not null default gen_random_uuid (),
  title text not null,
  content text not null,
  published_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  type text null default 'announcement'::text,
  is_pinned boolean null default false,
  target_section text null,
  constraint announcements_pkey primary key (id),
  constraint announcements_published_by_fkey foreign KEY (published_by) references auth.users (id),
  constraint announcements_type_check check (
    (
      type = any (
        array[
          'announcement'::text,
          'notice'::text,
          'reminder'::text,
          'urgent'::text,
          'event'::text,
          'fee_update'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_announcements_type on public.announcements using btree (type) TABLESPACE pg_default;

create index IF not exists idx_announcements_is_pinned on public.announcements using btree (is_pinned) TABLESPACE pg_default;

create index IF not exists idx_announcements_created_at on public.announcements using btree (created_at desc) TABLESPACE pg_default;

create trigger update_announcements_updated_at BEFORE
update on announcements for EACH row
execute FUNCTION update_updated_at_column ();

create table public.announcements (
  id uuid not null default gen_random_uuid (),
  title text not null,
  content text not null,
  published_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  type text null default 'announcement'::text,
  is_pinned boolean null default false,
  target_section text null,
  constraint announcements_pkey primary key (id),
  constraint announcements_published_by_fkey foreign KEY (published_by) references auth.users (id),
  constraint announcements_type_check check (
    (
      type = any (
        array[
          'announcement'::text,
          'notice'::text,
          'reminder'::text,
          'urgent'::text,
          'event'::text,
          'fee_update'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_announcements_type on public.announcements using btree (type) TABLESPACE pg_default;

create index IF not exists idx_announcements_is_pinned on public.announcements using btree (is_pinned) TABLESPACE pg_default;

create index IF not exists idx_announcements_created_at on public.announcements using btree (created_at desc) TABLESPACE pg_default;

create trigger update_announcements_updated_at BEFORE
update on announcements for EACH row
execute FUNCTION update_updated_at_column ();


create table public.audit_logs (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  action text not null,
  table_name text not null,
  record_id uuid not null,
  old_data jsonb null,
  new_data jsonb null,
  created_at timestamp with time zone not null default now(),
  constraint audit_logs_pkey primary key (id),
  constraint audit_logs_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete set null,
  constraint audit_logs_action_check check (
    (
      action = any (
        array['INSERT'::text, 'UPDATE'::text, 'DELETE'::text]
      )
    )
  )
) TABLESPACE pg_default;

create table public.installments (
  id uuid not null default gen_random_uuid (),
  schedule_id uuid not null,
  amount numeric(10, 2) not null,
  due_date date not null,
  status text not null default 'pending'::text,
  paid_date timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint installments_pkey primary key (id),
  constraint installments_schedule_id_fkey foreign KEY (schedule_id) references payment_schedules (id) on delete CASCADE,
  constraint installments_status_check check (
    (
      status = any (
        array['pending'::text, 'paid'::text, 'overdue'::text]
      )
    )
  )
) TABLESPACE pg_default;

create table public.messages (
  id uuid not null default gen_random_uuid (),
  thread_id uuid not null,
  sender_id uuid not null,
  recipient_id uuid not null,
  body text not null,
  type text not null default 'message'::text,
  read_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint messages_pkey primary key (id),
  constraint messages_recipient_id_fkey foreign KEY (recipient_id) references auth.users (id) on delete CASCADE,
  constraint messages_sender_id_fkey foreign KEY (sender_id) references auth.users (id) on delete CASCADE,
  constraint messages_type_check check (
    (
      type = any (
        array[
          'message'::text,
          'penalty'::text,
          'reminder'::text,
          'announcement'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_messages_thread_id on public.messages using btree (thread_id) TABLESPACE pg_default;

create index IF not exists idx_messages_sender on public.messages using btree (sender_id) TABLESPACE pg_default;

create index IF not exists idx_messages_recipient on public.messages using btree (recipient_id) TABLESPACE pg_default;

create index IF not exists idx_messages_created_at on public.messages using btree (created_at) TABLESPACE pg_default;

create table public.notifications (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  title text not null,
  message text not null,
  type text not null default 'info'::text,
  read_status boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint notifications_pkey primary key (id),
  constraint notifications_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint notifications_type_check check (
    (
      type = any (
        array[
          'reminder'::text,
          'confirmation'::text,
          'announcement'::text,
          'overdue'::text,
          'info'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_notifications_user on public.notifications using btree (user_id) TABLESPACE pg_default;

create table public.notifications (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  title text not null,
  message text not null,
  type text not null default 'info'::text,
  read_status boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint notifications_pkey primary key (id),
  constraint notifications_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint notifications_type_check check (
    (
      type = any (
        array[
          'reminder'::text,
          'confirmation'::text,
          'announcement'::text,
          'overdue'::text,
          'info'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_notifications_user on public.notifications using btree (user_id) TABLESPACE pg_default;

create table public.payment_schedules (
  id uuid not null default gen_random_uuid (),
  vendor_id uuid not null,
  stall_id uuid null,
  due_date date not null,
  amount numeric(10, 2) not null,
  payment_type text not null default 'due'::text,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  penalty_amount numeric(10, 2) null default 0,
  penalty_applied_at timestamp with time zone null,
  constraint payment_schedules_pkey primary key (id),
  constraint payment_schedules_stall_id_fkey foreign KEY (stall_id) references stalls (id),
  constraint payment_schedules_vendor_id_fkey foreign KEY (vendor_id) references vendors (id) on delete CASCADE,
  constraint payment_schedules_payment_type_check check (
    (
      payment_type = any (array['due'::text, 'staggered'::text])
    )
  ),
  constraint payment_schedules_status_check check (
    (
      status = any (
        array['pending'::text, 'paid'::text, 'overdue'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_payment_schedules_vendor on public.payment_schedules using btree (vendor_id) TABLESPACE pg_default;

create trigger audit_payment_schedules
after INSERT
or DELETE
or
update on payment_schedules for EACH row
execute FUNCTION log_audit_event ();

create table public.payment_submissions (
  id uuid not null default gen_random_uuid (),
  vendor_id uuid not null,
  vendor_user_id uuid not null,
  stall_id uuid null,
  amount numeric(10, 2) not null,
  period_month integer not null,
  period_year integer not null,
  payment_method text not null default 'instapay'::text,
  payment_type text not null default 'due'::text,
  receipt_url text not null,
  receipt_path text not null,
  ocr_reference text null,
  ocr_amount numeric(10, 2) null,
  ocr_datetime text null,
  ocr_recipient text null,
  ocr_raw text null,
  status text not null default 'pending'::text,
  payment_id uuid null,
  rejection_reason text null,
  processed_by uuid null,
  processed_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint payment_submissions_pkey primary key (id),
  constraint payment_submissions_vendor_user_id_fkey foreign KEY (vendor_user_id) references auth.users (id) on delete CASCADE,
  constraint payment_submissions_vendor_id_fkey foreign KEY (vendor_id) references vendors (id) on delete CASCADE,
  constraint payment_submissions_payment_id_fkey foreign KEY (payment_id) references payments (id),
  constraint payment_submissions_processed_by_fkey foreign KEY (processed_by) references auth.users (id),
  constraint payment_submissions_stall_id_fkey foreign KEY (stall_id) references stalls (id),
  constraint payment_submissions_payment_type_check check (
    (
      payment_type = any (array['due'::text, 'staggered'::text])
    )
  ),
  constraint payment_submissions_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'accepted'::text,
          'rejected'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create trigger payment_submissions_updated_at BEFORE
update on payment_submissions for EACH row
execute FUNCTION update_updated_at ();

create table public.payments (
  id uuid not null default gen_random_uuid (),
  vendor_id uuid not null,
  stall_id uuid null,
  amount numeric(10, 2) not null,
  payment_method text not null,
  payment_type text not null default 'due'::text,
  status text not null default 'pending'::text,
  reference_number text null,
  receipt_number text null,
  period_month integer null,
  period_year integer null,
  processed_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  paymongo_source_id text null,
  paid_at timestamp with time zone null,
  shift_id uuid null,
  constraint payments_pkey primary key (id),
  constraint payments_processed_by_fkey foreign KEY (processed_by) references auth.users (id),
  constraint payments_stall_id_fkey foreign KEY (stall_id) references stalls (id),
  constraint payments_vendor_id_fkey foreign KEY (vendor_id) references vendors (id) on delete CASCADE,
  constraint payments_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'completed'::text,
          'failed'::text,
          'overdue'::text
        ]
      )
    )
  ),
  constraint payments_payment_type_check check (
    (
      payment_type = any (
        array['due'::text, 'staggered'::text, 'manual'::text]
      )
    )
  ),
  constraint payments_payment_method_check check (
    (
      payment_method = any (
        array[
          'gcash'::text,
          'paymaya'::text,
          'instapay'::text,
          'cash'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_payments_vendor_id on public.payments using btree (vendor_id) TABLESPACE pg_default;

create index IF not exists idx_payments_status on public.payments using btree (status) TABLESPACE pg_default;

create index IF not exists idx_payments_created_at on public.payments using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_payments_reference_number on public.payments using btree (reference_number) TABLESPACE pg_default;

create index IF not exists idx_payments_shift_id on public.payments using btree (shift_id) TABLESPACE pg_default;

create trigger audit_payments
after INSERT
or DELETE
or
update on payments for EACH row
execute FUNCTION log_audit_event ();

create trigger auto_generate_payment_ref BEFORE INSERT on payments for EACH row
execute FUNCTION generate_payment_reference ();

create trigger update_payments_updated_at BEFORE
update on payments for EACH row
execute FUNCTION update_updated_at_column ();

create table public.push_subscriptions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamp with time zone not null default now(),
  constraint push_subscriptions_pkey primary key (id),
  constraint push_subscriptions_user_id_endpoint_key unique (user_id, endpoint),
  constraint push_subscriptions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_push_subs_user_id on public.push_subscriptions using btree (user_id) TABLESPACE pg_default;

create table public.push_subscriptions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamp with time zone not null default now(),
  constraint push_subscriptions_pkey primary key (id),
  constraint push_subscriptions_user_id_endpoint_key unique (user_id, endpoint),
  constraint push_subscriptions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_push_subs_user_id on public.push_subscriptions using btree (user_id) TABLESPACE pg_default;

create table public.sms_logs (
  id uuid not null default gen_random_uuid (),
  recipient text not null,
  recipient_user_id uuid null,
  message text not null,
  type text not null,
  status text not null default 'pending'::text,
  sent_by uuid null,
  sent_at timestamp with time zone not null default now(),
  constraint sms_logs_pkey primary key (id),
  constraint sms_logs_recipient_user_id_fkey foreign KEY (recipient_user_id) references auth.users (id),
  constraint sms_logs_sent_by_fkey foreign KEY (sent_by) references auth.users (id),
  constraint sms_logs_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'delivered'::text,
          'failed'::text
        ]
      )
    )
  ),
  constraint sms_logs_type_check check (
    (
      type = any (
        array[
          'reminder'::text,
          'confirmation'::text,
          'announcement'::text,
          'overdue'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_sms_logs_sent_at on public.sms_logs using btree (sent_at) TABLESPACE pg_default;

create table public.stall_fee_schedules (
  id uuid not null default gen_random_uuid (),
  stall_id uuid not null,
  year integer not null,
  month integer not null,
  amount numeric(10, 2) not null,
  note text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint stall_fee_schedules_pkey primary key (id),
  constraint stall_fee_schedules_stall_id_year_month_key unique (stall_id, year, month),
  constraint stall_fee_schedules_stall_id_fkey foreign KEY (stall_id) references stalls (id) on delete CASCADE,
  constraint stall_fee_schedules_month_check check (
    (
      (month >= 1)
      and (month <= 12)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_fee_schedules_stall_id on public.stall_fee_schedules using btree (stall_id) TABLESPACE pg_default;

create index IF not exists idx_fee_schedules_year on public.stall_fee_schedules using btree (year) TABLESPACE pg_default;

create trigger fee_schedule_updated_at BEFORE
update on stall_fee_schedules for EACH row
execute FUNCTION update_fee_schedule_updated_at ();

create table public.stalls (
  id uuid not null default gen_random_uuid (),
  stall_number text not null,
  section text not null default 'General'::text,
  location text null,
  monthly_rate numeric(10, 2) not null,
  status text not null default 'vacant'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint stalls_pkey primary key (id),
  constraint stalls_stall_number_key unique (stall_number),
  constraint stalls_status_check check (
    (
      status = any (array['occupied'::text, 'vacant'::text])
    )
  )
) TABLESPACE pg_default;

create trigger audit_stalls
after INSERT
or DELETE
or
update on stalls for EACH row
execute FUNCTION log_audit_event ();

create trigger update_stalls_updated_at BEFORE
update on stalls for EACH row
execute FUNCTION update_updated_at_column ();

create table public.vendors (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  stall_id uuid null,
  qr_code text null,
  tax_id text null,
  award_date date null,
  documents text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint vendors_pkey primary key (id),
  constraint vendors_user_id_key unique (user_id),
  constraint vendors_stall_id_fkey foreign KEY (stall_id) references stalls (id) on delete set null,
  constraint vendors_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_vendors_user_id on public.vendors using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_vendors_stall_id on public.vendors using btree (stall_id) TABLESPACE pg_default;

create trigger audit_vendors
after INSERT
or DELETE
or
update on vendors for EACH row
execute FUNCTION log_audit_event ();

create trigger auto_generate_qr_code BEFORE INSERT on vendors for EACH row
execute FUNCTION generate_vendor_qr_code ();

create trigger update_vendors_updated_at BEFORE
update on vendors for EACH row
execute FUNCTION update_updated_at_column ();

create table public.vendor_documents (
  id uuid not null default gen_random_uuid (),
  vendor_id uuid not null,
  document_type text not null,
  file_url text not null,
  expiry_date date null,
  status text not null default 'valid'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint vendor_documents_pkey primary key (id),
  constraint vendor_documents_vendor_id_fkey foreign KEY (vendor_id) references vendors (id) on delete CASCADE,
  constraint vendor_documents_status_check check (
    (
      status = any (array['valid'::text, 'expired'::text, 'expiring_soon'::text])
    )
  )
) TABLESPACE pg_default;

create trigger update_vendor_documents_updated_at BEFORE
update on vendor_documents for EACH row
execute FUNCTION update_updated_at_column ();

-- IMPORTANT: You must also create a storage bucket named "vendor_documents" and set it to public.
-- The following command creates the bucket if the storage schema is enabled.
insert into storage.buckets (id, name, public)
values ('vendor_documents', 'vendor_documents', true)
on conflict (id) do nothing;