-- The assistant's knowledge of projects used to come entirely from hand-written rows in
-- public.public_knowledge_base, so a project added through the admin dashboard was invisible to the AI until
-- someone manually wrote a matching knowledge-base entry. This view makes the always-current, published project
-- list itself a direct, automatic source for the assistant: whatever is live on /projects is what it knows about,
-- the moment it's published, no manual step required.
--
-- Same minimal-grant shape as public_knowledge_base: a view over only the public-safe columns of already-public
-- data (everything here is already visible to any visitor on the live site), restricted to chatbot_reader so the
-- login's privileges stay exactly as narrow as before.

create or replace view public.chat_live_projects as
select slug, title, description, long_description, tech_stack, tags, live_url
  from public.projects
 where status = 'Published'
 order by sort_order nulls last, created_at;

revoke all on public.chat_live_projects from public, anon, authenticated;
grant select on public.chat_live_projects to chatbot_reader;
