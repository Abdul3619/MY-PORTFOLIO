-- Discovery while building AtelierFit's compact gallery: this Supabase project already has a full, separate
-- backend for the Agbada Luxe / Atelier Noir product catalog -- `agbada_products` (plus agbada_admins,
-- agbada_bookings, agbada_settings, etc.) -- that isn't part of the my-portfolio codebase at all. It belongs to
-- a different app/codebase this session hasn't been given access to, but it shares this same Supabase project,
-- and it's clearly the real system of record for Atelier Noir's catalog: `name`, `description`, `price`,
-- `category` (free text), `image_url`/`image_path`, `is_published`, `sort_order` are all already there.
--
-- Rather than building a second, parallel gallery_categories/gallery_items schema (which would just create two
-- disagreeing sources of truth for the same content), this adds the two columns AtelierFit's unisex/
-- international direction actually needs on top of what already exists:
--   - region: nullable, free text, filled in only when genuinely known from a real photo -- never guessed.
--     (Exactly the mistake already made once in this session's hardcoded gallery: inventing a country/culture
--     name for an unverified stock image. This column defaults to NULL rather than a guessed value.)
--   - is_unisex: boolean, defaults true, so new products are unisex unless someone deliberately says otherwise.
--
-- No RLS policy changes: the table has RLS enabled with zero existing policies, meaning only the service-role
-- key can read or write it today (the other app's own server, presumably). my-portfolio's new read-only
-- `/api/gallery` route (added alongside this migration) uses that same service-role key server-side, the same
-- way the existing atelierfit and outreach routers already do -- it does not add a public anon policy, so it
-- doesn't change who else can read this table.

alter table agbada_products
  add column if not exists region text,
  add column if not exists is_unisex boolean not null default true;
