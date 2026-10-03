-- StitchBook: a desktop-oriented tailor-shop management demo (orders + fabric/inventory tracking).
-- Unlike atelierfit_orders (a real customer-facing intake form), this is a live, public PORTFOLIO DEMO of a
-- desktop app concept -- visitors can add/edit/delete rows to try it, so RLS intentionally allows anon full
-- CRUD. The server enforces a row cap per table (oldest rows pruned on insert) to keep the demo data from
-- growing unbounded; see stitchbook/route.ts.

create table if not exists public.stitchbook_orders (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (char_length(client_name) between 1 and 120),
  client_phone text,
  garment text not null check (char_length(garment) between 1 and 120),
  fabric_source text check (fabric_source in ('client_provided', 'shop_stock')),
  price_naira integer not null check (price_naira >= 0),
  deposit_naira integer not null default 0 check (deposit_naira >= 0),
  due_date date,
  status text not null default 'New' check (status in ('New', 'Cutting', 'Sewing', 'Fitting', 'Ready', 'Delivered', 'Cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stitchbook_inventory (
  id uuid primary key default gen_random_uuid(),
  item_name text not null check (char_length(item_name) between 1 and 120),
  category text not null default 'Fabric' check (category in ('Fabric', 'Thread', 'Button/Zip', 'Lining', 'Other')),
  quantity numeric not null default 0 check (quantity >= 0),
  unit text not null default 'yards' check (unit in ('yards', 'meters', 'rolls', 'pieces', 'sets')),
  reorder_level numeric not null default 5 check (reorder_level >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stitchbook_orders enable row level security;
alter table public.stitchbook_inventory enable row level security;

create policy "public demo: anyone can read orders" on public.stitchbook_orders for select using (true);
create policy "public demo: anyone can insert orders" on public.stitchbook_orders for insert with check (true);
create policy "public demo: anyone can update orders" on public.stitchbook_orders for update using (true);
create policy "public demo: anyone can delete orders" on public.stitchbook_orders for delete using (true);

create policy "public demo: anyone can read inventory" on public.stitchbook_inventory for select using (true);
create policy "public demo: anyone can insert inventory" on public.stitchbook_inventory for insert with check (true);
create policy "public demo: anyone can update inventory" on public.stitchbook_inventory for update using (true);
create policy "public demo: anyone can delete inventory" on public.stitchbook_inventory for delete using (true);

-- Seed a few realistic rows so the demo never looks empty on first load.
insert into public.stitchbook_orders (client_name, client_phone, garment, fabric_source, price_naira, deposit_naira, due_date, status, notes)
values
  ('Tunde Bakare', '080XXXXXXX', 'Agbada (full set)', 'shop_stock', 65000, 26000, current_date + interval '5 days', 'Sewing', 'Gold embroidery on collar'),
  ('Ngozi Eze', '081XXXXXXX', 'Senator Suit', 'client_provided', 40000, 40000, current_date + interval '2 days', 'Fitting', 'Paid in full, needs final fitting'),
  ('Chidi Obi', '070XXXXXXX', 'Kaftan', 'shop_stock', 35000, 10000, current_date + interval '9 days', 'New', null)
on conflict do nothing;

insert into public.stitchbook_inventory (item_name, category, quantity, unit, reorder_level, notes)
values
  ('Atiku (wine)', 'Fabric', 12, 'yards', 10, 'Popular for senator suits'),
  ('Aso-Oke (gold)', 'Fabric', 4, 'yards', 8, 'Low -- reorder soon'),
  ('Gold embroidery thread', 'Thread', 3, 'rolls', 5, null),
  ('Agbada buttons (set)', 'Button/Zip', 15, 'sets', 6, null)
on conflict do nothing;
