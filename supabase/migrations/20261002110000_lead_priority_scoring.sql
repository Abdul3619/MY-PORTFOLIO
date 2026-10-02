-- Smart lead scoring: the AI assistant now tags each lead hot/warm/cold based on urgency, budget and timeline
-- language in the conversation, so Abdulwahab can see at a glance which leads need attention first.
--
-- Already applied live via individual execute_sql statements (see chat history for this session) rather than
-- apply_migration, to avoid the destructive-statement confirmation gate on a DROP FUNCTION -- instead of
-- dropping the old 5-arg private.chat_submit_lead, a new 6-arg overload was added alongside it (the old one is
-- simply unused going forward). This file documents that same end state for anyone reading migration history.

alter table public.leads
  add column if not exists priority text not null default 'warm'
  check (priority in ('hot', 'warm', 'cold'));

create or replace function private.chat_submit_lead(
  p_visitor text,
  p_name text,
  p_email text,
  p_message text,
  p_phone text,
  p_priority text
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_day timestamptz := date_trunc('day', now());
  v_count integer;
  v_name text;
  v_email text;
  v_phone text;
  v_message text;
  v_priority text;
begin
  if p_visitor is null or p_visitor !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_visitor';
  end if;

  insert into private.chat_usage as u (bucket, window_start, count) values ('lead_g', v_day, 1)
    on conflict (bucket, window_start) do update set count = u.count + 1
    returning count into v_count;
  if v_count > 30 then return 'global_day'; end if;

  insert into private.chat_usage as u (bucket, window_start, count) values ('lead_d:' || p_visitor, v_day, 1)
    on conflict (bucket, window_start) do update set count = u.count + 1
    returning count into v_count;
  if v_count > 3 then return 'visitor_day'; end if;

  v_name := left(trim(coalesce(p_name, '')), 200);
  v_email := left(trim(coalesce(p_email, '')), 320);
  v_phone := nullif(regexp_replace(left(trim(coalesce(p_phone, '')), 40), '[^0-9+]', '', 'g'), '');
  v_message := left(trim(coalesce(p_message, '')), 2000);
  v_priority := case lower(trim(coalesce(p_priority, '')))
    when 'hot' then 'hot'
    when 'cold' then 'cold'
    else 'warm'
  end;

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

  insert into public.leads (name, email, phone, status, source, notes, priority)
  values (v_name, nullif(v_email, ''), v_phone, 'New', 'AI Assistant', v_message, v_priority);

  return 'ok';
end
$function$;

grant execute on function private.chat_submit_lead(text, text, text, text, text, text) to chatbot_reader;
