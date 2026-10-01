-- Lets the portfolio assistant save a lead directly, when a visitor gives their contact details in chat and
-- clearly wants to be contacted, instead of only being able to point them at the separate contact form.
--
-- Security model, same spirit as the knowledge base read path: chatbot_reader gets EXECUTE on exactly one new
-- function and nothing else. The function only ever inserts into public.leads with a fixed small set of columns
-- (name, email, phone, source, notes) that the model fills in -- it cannot run arbitrary SQL, touch any other
-- table, or read anything back. A visitor-scoped quota (reusing the same salted visitor key as chat_take_quota)
-- caps this at a few leads per visitor per day and a modest site-wide daily total, so a flood of junk can't run
-- up the leads table or be used to hide a real lead among noise.

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

  -- Site-wide: at most 30 chat-submitted leads a day (a real flood would come through the contact form's own
  -- limits anyway; this just stops the assistant itself being used to spam the leads table).
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
  v_phone := nullif(left(trim(coalesce(p_phone, '')), 40), '');
  v_message := left(trim(coalesce(p_message, '')), 2000);

  if v_name = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return 'invalid_input';
  end if;

  insert into public.leads (name, email, phone, status, source, notes)
  values (v_name, v_email, v_phone, 'New', 'AI Assistant', v_message);

  return 'ok';
end $$;

revoke all on function private.chat_submit_lead(text, text, text, text, text) from public, anon, authenticated;
grant execute on function private.chat_submit_lead(text, text, text, text, text) to chatbot_reader;
