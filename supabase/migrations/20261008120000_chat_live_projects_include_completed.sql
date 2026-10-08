-- The frontend treats both 'Published' and 'Completed' as public (src/lib/projectStatus.ts), but the assistant's
-- view only listed 'Published', so Completed projects (H'orizon, Azure Hotel) were invisible to the assistant:
-- it couldn't offer their live link or H'orizon's admin dashboard. Align the view with the public definition.

create or replace view public.chat_live_projects as
select slug, title, description, long_description, tech_stack, tags, live_url, has_dashboard
  from public.projects
 where status in ('Published', 'Completed')
 order by sort_order nulls last, created_at;

revoke all on public.chat_live_projects from public, anon, authenticated;
grant select on public.chat_live_projects to chatbot_reader;
