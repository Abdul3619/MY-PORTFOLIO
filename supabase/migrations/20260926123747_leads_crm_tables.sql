-- CRM tables for the Solar Estimator lead pipeline (POST /api/leads) and the admin Leads / Dashboard pages.
-- Public submissions are written by the server with the service role; only the admin account can read or edit them.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  company text,
  status text not null default 'New'
    check (status in ('New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost')),
  value numeric(12, 2),
  source text not null default 'Web Inbound',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists lead_notes_lead_id_idx on public.lead_notes (lead_id, created_at desc);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);

create or replace function public.set_leads_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_leads_updated_at();

alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
alter table public.activity_log enable row level security;

-- Leads contain visitors' contact details, so access is limited to the portfolio owner's account.
create policy "Leads are managed by the admin"
  on public.leads for all to authenticated
  using ((select auth.jwt() ->> 'email') = 'abdulwahababdullah3619@gmail.com')
  with check ((select auth.jwt() ->> 'email') = 'abdulwahababdullah3619@gmail.com');

create policy "Lead notes are managed by the admin"
  on public.lead_notes for all to authenticated
  using ((select auth.jwt() ->> 'email') = 'abdulwahababdullah3619@gmail.com')
  with check ((select auth.jwt() ->> 'email') = 'abdulwahababdullah3619@gmail.com');

create policy "Activity log is managed by the admin"
  on public.activity_log for all to authenticated
  using ((select auth.jwt() ->> 'email') = 'abdulwahababdullah3619@gmail.com')
  with check ((select auth.jwt() ->> 'email') = 'abdulwahababdullah3619@gmail.com');
