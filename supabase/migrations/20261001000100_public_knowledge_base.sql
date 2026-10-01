-- Knowledge base for the portfolio AI assistant, and the restricted database login the assistant uses.
--
-- Security model
-- * public_knowledge_base holds only content the assistant may share (bio, case studies, pricing approach,
--   FAQs, process). Anything private lives in other tables, which are owner-only (see the previous migration).
-- * The chat endpoint connects to Postgres as chatbot_reader. That login has SELECT on public_knowledge_base and
--   EXECUTE on one quota function, and no privileges on any other table, so it cannot read private data no
--   matter what a visitor types. The model itself has no tools and never writes SQL; the server runs one fixed,
--   parameterised query.
-- * chatbot_reader's password is set separately (not in this file) and only stored in the server environment.

-- ---------- Knowledge base ----------

create table if not exists public.public_knowledge_base (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('bio', 'project', 'service', 'pricing', 'faq', 'process', 'contact')),
  title text not null check (char_length(title) between 1 and 200),
  content text not null check (char_length(content) between 1 and 4000),
  -- Extra search words (synonyms, technologies) that help retrieval but aren't shown verbatim
  keywords text not null default '' check (char_length(keywords) <= 1000),
  -- Core facts sent with every question (kept short), regardless of search match
  always_include boolean not null default false,
  -- Drafts stay invisible to the assistant until published
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', keywords), 'B') ||
    setweight(to_tsvector('english', content), 'C')
  ) stored
);

create index if not exists public_knowledge_base_search_idx on public.public_knowledge_base using gin (search);
create index if not exists public_knowledge_base_published_idx on public.public_knowledge_base (is_published, always_include);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

revoke all on function private.touch_updated_at() from public;

drop trigger if exists public_knowledge_base_touch on public.public_knowledge_base;
create trigger public_knowledge_base_touch before update on public.public_knowledge_base
  for each row execute function private.touch_updated_at();

alter table public.public_knowledge_base enable row level security;
revoke all on public.public_knowledge_base from public, anon, authenticated;
-- The owner can manage entries from the admin dashboard (RLS limits this to the owner's account)
grant select, insert, update, delete on public.public_knowledge_base to authenticated;

create policy "Owner manages knowledge base" on public.public_knowledge_base
  for all to authenticated
  using ((select private.is_portfolio_owner()))
  with check ((select private.is_portfolio_owner()));

-- ---------- Restricted login for the chat endpoint ----------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'chatbot_reader') then
    create role chatbot_reader with login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls connection limit 20;
  end if;
end $$;

alter role chatbot_reader set statement_timeout = '5s';
alter role chatbot_reader set idle_in_transaction_session_timeout = '10s';
alter role chatbot_reader set search_path = '';

grant usage on schema public to chatbot_reader;
grant select on public.public_knowledge_base to chatbot_reader;

create policy "Assistant reads published entries" on public.public_knowledge_base
  for select to chatbot_reader
  using (is_published);

-- ---------- Usage limits (protects the AI API bill) ----------

-- Per-visitor and site-wide message counters. The visitor key is a salted hash computed by the server, so no
-- IP addresses are stored. Nobody but the quota function can read or write this table.
create table if not exists private.chat_usage (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);
alter table private.chat_usage enable row level security;
revoke all on private.chat_usage from public, anon, authenticated;

-- Counts one message and returns whether it is allowed. Limits: per visitor 8 per minute and 60 per day,
-- site-wide 1000 per day. Returns 'ok', 'visitor_minute', 'visitor_day' or 'global_day'.
create or replace function private.chat_take_quota(p_visitor text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_minute timestamptz := date_trunc('minute', now());
  v_day timestamptz := date_trunc('day', now());
  v_count integer;
begin
  if p_visitor is null or p_visitor !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_visitor';
  end if;

  insert into private.chat_usage as u (bucket, window_start, count) values ('g', v_day, 1)
    on conflict (bucket, window_start) do update set count = u.count + 1
    returning count into v_count;
  if v_count > 1000 then return 'global_day'; end if;

  insert into private.chat_usage as u (bucket, window_start, count) values ('d:' || p_visitor, v_day, 1)
    on conflict (bucket, window_start) do update set count = u.count + 1
    returning count into v_count;
  if v_count > 60 then return 'visitor_day'; end if;

  insert into private.chat_usage as u (bucket, window_start, count) values ('m:' || p_visitor, v_minute, 1)
    on conflict (bucket, window_start) do update set count = u.count + 1
    returning count into v_count;
  if v_count > 8 then return 'visitor_minute'; end if;

  -- Housekeeping: drop counters older than two days
  delete from private.chat_usage where window_start < now() - interval '2 days';
  return 'ok';
end $$;

revoke all on function private.chat_take_quota(text) from public, anon, authenticated;
grant usage on schema private to chatbot_reader;
grant execute on function private.chat_take_quota(text) to chatbot_reader;
