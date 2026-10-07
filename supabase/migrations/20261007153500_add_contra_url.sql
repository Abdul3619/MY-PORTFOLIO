-- Second escrow-protected hiring option alongside Upwork, surfaced on the Contact page.
ALTER TABLE contact_information ADD COLUMN IF NOT EXISTS contra_url text;
