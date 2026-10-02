-- AtelierFit: AI-assisted tailor order + measurement app (new portfolio project, built overnight per
-- Abdulwahab's go-ahead on 2026-10-03). Visitors place a real garment order, get measured either by the
-- on-device camera flow or manual entry, and pay a deposit/full amount via Paystack.
--
-- Mirrors a migration already applied directly to the project's Supabase instance; kept here so the schema
-- lives in version control like every other table in this repo.

create table public.atelierfit_orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_email text not null check (char_length(customer_email) <= 254 and customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  customer_phone text check (customer_phone is null or char_length(customer_phone) <= 30),
  garment_type text not null check (char_length(garment_type) between 1 and 80),
  notes text check (notes is null or char_length(notes) <= 2000),

  -- Measurements, always in centimetres, however they were obtained
  measurements jsonb not null default '{}'::jsonb,
  measurement_method text not null default 'manual' check (measurement_method in ('camera_ai', 'manual')),
  -- Honest confidence flag for camera-estimated measurements: visitor can always review/correct before paying
  measurements_confirmed_by_customer boolean not null default false,

  amount_kobo integer not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency in ('NGN', 'USD', 'GHS', 'XOF')),
  payment_provider text not null default 'paystack' check (payment_provider in ('paystack', 'flutterwave', 'stripe')),
  payment_reference text unique,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed')),

  status text not null default 'New' check (status in ('New', 'Confirmed', 'In Progress', 'Ready', 'Delivered', 'Cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index atelierfit_orders_status_idx on public.atelierfit_orders (status, created_at desc);
create index atelierfit_orders_payment_ref_idx on public.atelierfit_orders (payment_reference);

alter table public.atelierfit_orders enable row level security;

-- Visitors can create their own order (the public checkout form) but can never read, list, or edit any
-- order afterwards -- not even their own -- since the payment reference alone shouldn't be enough to pull
-- someone's name/email/measurements back out over the anon key. All reading/updating happens server-side
-- with the service role (order confirmation emails, the admin dashboard), exactly like leads/contact_messages.
create policy "anon can submit an order" on public.atelierfit_orders
  for insert to anon
  with check (true);

revoke select, update, delete on public.atelierfit_orders from anon, authenticated;
grant insert on public.atelierfit_orders to anon;
