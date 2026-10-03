-- AtelierFit: adds the fields needed for the new Design Review step (fabric/embroidery/occasion) and the
-- new Booking step (appointment date/time), both built from the reference designs Abdulwahab shared on
-- 2026-10-03. Nullable/defaulted so existing rows (and the admin view) keep working unchanged.

alter table public.atelierfit_orders
  add column if not exists fabric text check (fabric is null or char_length(fabric) <= 60),
  add column if not exists fabric_surcharge_kobo integer not null default 0 check (fabric_surcharge_kobo >= 0),
  add column if not exists embroidery_notes text check (embroidery_notes is null or char_length(embroidery_notes) <= 500),
  add column if not exists occasion text check (occasion is null or char_length(occasion) <= 40),
  add column if not exists appointment_date date,
  add column if not exists appointment_time text check (appointment_time is null or char_length(appointment_time) <= 20);
