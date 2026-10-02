-- New per-project flag: a project whose demo includes an admin/booking dashboard can be marked has_dashboard,
-- which hides its "Visit Live Site" link on the public project page. The AI assistant still knows the real
-- live_url (via chat_live_projects below) and is instructed (see chatbot/systemPrompt.ts) to proactively offer
-- it as a button in conversation -- so the only way into that dashboard is through the assistant, never by
-- browsing the project section directly. Projects that don't have a dashboard are completely unaffected: the
-- column defaults to false and their public link keeps working exactly as before.

alter table public.projects
  add column if not exists has_dashboard boolean not null default false;

-- Recreated to expose the new flag to the assistant, so it knows which projects to proactively offer a
-- dashboard button for.
create or replace view public.chat_live_projects as
select slug, title, description, long_description, tech_stack, tags, live_url, has_dashboard
  from public.projects
 where status = 'Published'
 order by sort_order nulls last, created_at;

revoke all on public.chat_live_projects from public, anon, authenticated;
grant select on public.chat_live_projects to chatbot_reader;
