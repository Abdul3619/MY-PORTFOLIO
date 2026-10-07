-- Real fabric/supplies inventory for the locked StitchBook dashboard (/admin/stitchbook).
--
-- This is deliberately a SEPARATE table from stitchbook_inventory: that one belongs to the public, no-login
-- /stitchbook portfolio demo (anon can CRUD it freely, see stitchbook/route.ts) and must stay exactly as-is.
-- workshop_inventory is Abdulwahab's own real stock data, locked down the same way agbada_products and
-- atelierfit_orders are: RLS enabled, zero grants to anon/authenticated, reachable only through the
-- service-role key the new admin router uses (server-side, behind requireAuth).
create table if not exists public.workshop_inventory (
  id uuid primary key default gen_random_uuid(),
  item_name text not null check (char_length(item_name) between 1 and 120),
  category text not null default 'Fabric' check (category in ('Fabric', 'Thread', 'Button/Zip', 'Lining', 'Embroidery Supplies', 'Other')),
  quantity numeric(12, 2) not null default 0 check (quantity >= 0),
  unit text not null default 'yards' check (unit in ('yards', 'meters', 'rolls', 'pieces', 'sets', 'spools')),
  reorder_level numeric(12, 2) not null default 5 check (reorder_level >= 0),
  cost_naira integer check (cost_naira is null or (cost_naira >= 0 and cost_naira <= 100000000)),
  supplier text check (supplier is null or char_length(supplier) <= 160),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workshop_inventory_low_stock_idx on public.workshop_inventory (quantity, reorder_level);

alter table public.workshop_inventory enable row level security;
-- No policies granted to anon/authenticated -- only the service-role key (used server-side by the new
-- requireAuth-gated /api/admin/stitchdash router) can read or write this table, same lockdown pattern as
-- agbada_products and atelierfit_orders.
