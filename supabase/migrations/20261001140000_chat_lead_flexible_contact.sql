-- Relaxes private.chat_submit_lead so a visitor can leave whichever contact method they actually use --
-- email, or a phone/WhatsApp number -- instead of email always being mandatory. WhatsApp is common in Africa
-- and Asia but far less so in, say, the US, so forcing "email" as the only identifying field made the chat
-- assistant unusable as a stand-in contact form for visitors who'd rather just leave a phone number.
--
-- Same grants and rate limits as before (chatbot_reader EXECUTE only, 3/visitor/day, 30/day site-wide); only
-- the input validation changes: name is still required, and at least one of email/phone must be present and
-- well-formed, but neither is individually mandatory any more.
--
-- public.leads.email was NOT NULL (every lead used to come from the contact form, which always collects an
-- email). A chat-submitted lead can now have a phone/WhatsApp number instead, so the column is relaxed to
-- nullable; the admin dashboard (AdminLeads.tsx) already falls back to "Unavailable" wherever it displays email.

alter table public.leads alter column email drop not null;

create or replace function private.chat_submit_lead(
  p_visitor text,
  p_name text,
  p_email text,
  p_message text,
  p_phone text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day timestamptz := date_trunc('day', now());
  v_count integer;
  v_name text;
  v_email text;
  v_phone text;
  v_message text;
begin
  if p_visitor is null or p_visitor !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_visitor';
  end if;

  -- Site-wide: at most 30 chat-submitted leads a day.
  insert into private.chat_usage as u (bucket, window_start, count) values ('lead_g', v_day, 1)
    on conflict (bucket, window_start) do update set count = u.count + 1
    returning count into v_count;
  if v_count > 30 then return 'global_day'; end if;

  -- Per visitor: at most 3 a day.
  insert into private.chat_usage as u (bucket, window_start, count) values ('lead_d:' || p_visitor, v_day, 1)
    on conflict (bucket, window_start) do update set count = u.count + 1
    returning count into v_count;
  if v_count > 3 then return 'visitor_day'; end if;

  v_name := left(trim(coalesce(p_name, '')), 200);
  v_email := left(trim(coalesce(p_email, '')), 320);
  -- A phone/WhatsApp number: keep only leading + and digits, so formatting (spaces, dashes, parens) from any
  -- country doesn't matter; just require enough digits to plausibly be a real number.
  v_phone := nullif(regexp_replace(left(trim(coalesce(p_phone, '')), 40), '[^0-9+]', '', 'g'), '');
  v_message := left(trim(coalesce(p_message, '')), 2000);

  if v_name = '' then
    return 'invalid_input';
  end if;

  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return 'invalid_input';
  end if;

  if v_phone is not null and length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7 then
    return 'invalid_input';
  end if;

  if v_email = '' and v_phone is null then
    return 'invalid_input';
  end if;

  insert into public.leads (name, email, phone, status, source, notes)
  values (v_name, nullif(v_email, ''), v_phone, 'New', 'AI Assistant', v_message);

  return 'ok';
end $$;

revoke all on function private.chat_submit_lead(text, text, text, text, text) from public, anon, authenticated;
grant execute on function private.chat_submit_lead(text, text, text, text, text) to chatbot_reader;
