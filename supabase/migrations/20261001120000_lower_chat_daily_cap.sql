-- Lower the site-wide chat quota from 1000/day to 150/day.
--
-- The portfolio won't realistically see anywhere near 1000 chatbot conversations a day right now, so the
-- original cap was unnecessary cost exposure for no benefit. Per-visitor limits (60/day, 8/minute) are
-- unchanged. Raise the global cap again later once real traffic justifies it.

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
  if v_count > 150 then return 'global_day'; end if;

  insert into private.chat_usage as u (bucket, window_start, count) values ('d:' || p_visitor, v_day, 1)
    on conflict (bucket, window_start) do update set count = u.count + 1
    returning count into v_count;
  if v_count > 60 then return 'visitor_day'; end if;

  insert into private.chat_usage as u (bucket, window_start, count) values ('m:' || p_visitor, v_minute, 1)
    on conflict (bucket, window_start) do update set count = u.count + 1
    returning count into v_count;
  if v_count > 8 then return 'visitor_minute'; end if;

  return 'ok';
end $$;

revoke all on function private.chat_take_quota(text) from public, anon, authenticated;
grant execute on function private.chat_take_quota(text) to chatbot_reader;
