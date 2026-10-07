-- Lets the Contact page point visitors who are wary of paying upfront to an escrow-protected Upwork profile
-- instead, without any code change once the URL is set from the admin dashboard.
ALTER TABLE contact_information ADD COLUMN IF NOT EXISTS upwork_url text;
