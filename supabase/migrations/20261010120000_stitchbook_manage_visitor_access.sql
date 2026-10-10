-- StitchBook Manage tab: groundwork for letting visitors try it, with automatic clean-up.
--
-- Real Inventory (workshop_inventory) now lives inside StitchBook instead of the portfolio /admin. These columns
-- and the edits table let visitor changes be flagged and undone after 24 hours: visitor-added stock rows are
-- marked, and an order's state before a visitor's first change is saved so it can be put back. Visitor writes
-- are not switched on yet; today only the signed-in owner can change real stock and orders.

alter table public.workshop_inventory
  add column if not exists visitor_created boolean not null default false,
  add column if not exists visitor_key text;

create index if not exists workshop_inventory_visitor_idx on public.workshop_inventory (visitor_created, created_at);

create table if not exists public.stitchbook_visitor_edits (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.atelierfit_orders (id) on delete cascade,
  original jsonb not null,
  visitor_key text,
  created_at timestamptz not null default now(),
  reverted_at timestamptz
);

create index if not exists stitchbook_visitor_edits_pending_idx on public.stitchbook_visitor_edits (order_id) where reverted_at is null;

alter table public.stitchbook_visitor_edits enable row level security;
-- No policies: only the server's service-role key touches this table. The 24-hour clean-up itself runs in
-- stitchbook/route.ts (cleanupVisitorData), on every Manage request, throttled.
