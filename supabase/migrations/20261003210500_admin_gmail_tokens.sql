-- A single-admin OAuth token store for the Gmail read-only connection used by the Inbox tab (see
-- inbox/route.ts). This is NOT the same thing as the ai_outreach_* tables -- this is Google's own OAuth
-- tokens (access + refresh), needed so the server can read the admin's Gmail INBOX and SENT folders on his
-- behalf without him re-authenticating every time.
--
-- Security model: RLS is enabled with NO policies at all, which means only the service-role key (used
-- exclusively by the server-side Express routes behind requireAuth -- see inbox/route.ts) can read or write
-- this table. The anon and authenticated Postgres roles get nothing, by default, with no extra grant needed.
-- This mirrors how every other genuinely sensitive table in this project is protected.
create table if not exists admin_gmail_tokens (
  id int primary key default 1,
  email text,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamptz not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_gmail_tokens_singleton check (id = 1)
);

alter table admin_gmail_tokens enable row level security;

comment on table admin_gmail_tokens is
  'Singleton row holding the admin''s Gmail OAuth tokens for the dashboard Inbox tab. Service-role only (no RLS policies).';
