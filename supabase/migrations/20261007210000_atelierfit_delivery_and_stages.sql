-- AtelierFit: real tailoring sub-stages (replacing the single catch-all "In Progress") plus a real
-- shipping/delivery path alongside workshop pickup -- added per Abdulwahab's 2026-10-07 request to make
-- the order-progress tracking and delivery flow real, not just a 5-stage placeholder.
--
-- Status progression is now, in order:
--   New -> Confirmed -> Cutting -> Sewing -> Embroidery -> Quality Check -> Ready -> Shipped (if delivery_method
--   is 'shipping') -> Delivered, or Ready -> Delivered directly for pickup orders. Cancelled can happen from
--   any pre-Delivered state. Set by the tailor from the admin dashboard exactly as the old statuses were.

-- Migrate existing rows out of the old catch-all value before the new constraint is applied, so this never
-- fails on data already in the table.
update public.atelierfit_orders set status = 'Cutting' where status = 'In Progress';

alter table public.atelierfit_orders
  drop constraint if exists atelierfit_orders_status_check;

alter table public.atelierfit_orders
  add constraint atelierfit_orders_status_check
  check (status in (
    'New', 'Confirmed', 'Cutting', 'Sewing', 'Embroidery', 'Quality Check',
    'Ready', 'Shipped', 'Delivered', 'Cancelled'
  ));

alter table public.atelierfit_orders
  add column if not exists delivery_method text not null default 'pickup' check (delivery_method in ('pickup', 'shipping')),
  add column if not exists shipping_address text check (shipping_address is null or char_length(shipping_address) <= 500),
  add column if not exists tracking_number text check (tracking_number is null or char_length(tracking_number) <= 80),
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

-- Used by the new /availability endpoint to compute booked slots for the real calendar (one appointment
-- slot per date+time, so this index makes "is this slot already taken" a fast lookup, not a full scan).
create index if not exists atelierfit_orders_appointment_idx
  on public.atelierfit_orders (appointment_date, appointment_time)
  where status <> 'Cancelled';
