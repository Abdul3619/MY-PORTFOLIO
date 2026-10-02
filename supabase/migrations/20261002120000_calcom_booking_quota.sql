-- Rate limit for the AI assistant's new book_call tool (Cal.com integration), mirroring the existing
-- submit_lead quota pattern -- private.chat_usage is the same generic per-bucket counter table already used
-- for message and lead quotas. Already applied live via execute_sql; this file documents that end state.

create or replace function private.chat_book_call_quota(p_visitor text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_day timestamptz := date_trunc('day', now());
  v_count integer;
begin
  if p_visitor is null or p_visitor !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_visitor';
  end if;

  -- Sitewide: at most 5 real bookings a day through the assistant. Abdulwahab can raise this once he's busier.
  insert into private.chat_usage as u (bucket, window_start, count) values ('book_g', v_day, 1)
    on conflict (bucket, window_start) do update set count = u.count + 1
    returning count into v_count;
  if v_count > 5 then return 'global_day'; end if;

  -- Per visitor: one booking a day is plenty for a single visitor talking to the assistant.
  insert into private.chat_usage as u (bucket, window_start, count) values ('book_d:' || p_visitor, v_day, 1)
    on conflict (bucket, window_start) do update set count = u.count + 1
    returning count into v_count;
  if v_count > 1 then return 'visitor_day'; end if;

  return 'ok';
end
$function$;

grant execute on function private.chat_book_call_quota(text) to chatbot_reader;
