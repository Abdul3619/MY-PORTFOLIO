-- Postgres grants EXECUTE on new functions to PUBLIC (every role, including chatbot_reader). Replace that blanket
-- grant with explicit grants for the API roles that actually had access, so no existing caller changes, and stop
-- future functions in public from defaulting to PUBLIC. After this, chatbot_reader can execute only
-- private.chat_take_quota and read only public.public_knowledge_base.
do $$
declare
  f record;
  r text;
begin
  for f in
    select p.oid, p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and has_function_privilege('chatbot_reader', p.oid, 'execute')
  loop
    foreach r in array array['anon', 'authenticated', 'service_role'] loop
      if has_function_privilege(r, f.oid, 'execute') then
        execute format('grant execute on function %s to %I', f.sig, r);
      end if;
    end loop;
    execute format('revoke execute on function %s from public', f.sig);
  end loop;
end $$;

alter default privileges in schema public revoke execute on functions from public;
