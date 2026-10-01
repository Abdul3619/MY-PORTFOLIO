-- Private data: only the portfolio owner's account can read or change it.
--
-- Before this migration several tables were readable or editable by ANY signed-in Supabase user
-- (policies of the form auth.role() = 'authenticated'), not just the owner. That covered contact messages,
-- visitor and analytics data, audit logs, and edits to profile/project content. Supabase Auth in this project
-- is shared with other apps, so "authenticated" is not the same as "the owner".
--
-- The server uses the service-role key (which bypasses RLS) and the admin dashboard signs in as the owner,
-- so neither is affected. Public pages read content through the server, not directly.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- True only for the owner's confirmed account. Checked against auth.users (not just the email claim in the
-- token), and SECURITY DEFINER so policies can call it without exposing auth.users.
create or replace function private.is_portfolio_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'abdulwahababdullah3619@gmail.com'
      and u.email_confirmed_at is not null
  )
$$;

revoke all on function private.is_portfolio_owner() from public;
grant execute on function private.is_portfolio_owner() to anon, authenticated;

-- ---------- Private tables: owner-only reads and changes ----------

-- contact_messages: anyone may still submit (the contact form); only the owner reads, edits or deletes.
drop policy if exists "Messages viewable by authenticated users." on public.contact_messages;
drop policy if exists "Messages modifiable by authenticated users." on public.contact_messages;
drop policy if exists "Messages deletable by authenticated users." on public.contact_messages;
create policy "Owner reads contact messages" on public.contact_messages for select to authenticated using ((select private.is_portfolio_owner()));
create policy "Owner updates contact messages" on public.contact_messages for update to authenticated using ((select private.is_portfolio_owner())) with check ((select private.is_portfolio_owner()));
create policy "Owner deletes contact messages" on public.contact_messages for delete to authenticated using ((select private.is_portfolio_owner()));

-- visitors: tracking writes go through the server (service role). Only the owner reads; nobody else updates.
drop policy if exists "Visitors viewable by authenticated users." on public.visitors;
drop policy if exists "Anyone can update their visitor data" on public.visitors;
create policy "Owner reads visitors" on public.visitors for select to authenticated using ((select private.is_portfolio_owner()));

-- analytics_events
drop policy if exists "Analytics viewable by authenticated users." on public.analytics_events;
create policy "Owner reads analytics" on public.analytics_events for select to authenticated using ((select private.is_portfolio_owner()));

-- audit_logs
drop policy if exists "Audit logs viewable by authenticated users." on public.audit_logs;
drop policy if exists "Audit logs insertable by authenticated users." on public.audit_logs;
create policy "Owner reads audit logs" on public.audit_logs for select to authenticated using ((select private.is_portfolio_owner()));
create policy "Owner writes audit logs" on public.audit_logs for insert to authenticated with check ((select private.is_portfolio_owner()));

-- leads, lead_notes, activity_log: already owner-only by email claim; switch to the shared owner check.
drop policy if exists "Leads are managed by the admin" on public.leads;
create policy "Owner manages leads" on public.leads for all to authenticated using ((select private.is_portfolio_owner())) with check ((select private.is_portfolio_owner()));
drop policy if exists "Lead notes are managed by the admin" on public.lead_notes;
create policy "Owner manages lead notes" on public.lead_notes for all to authenticated using ((select private.is_portfolio_owner())) with check ((select private.is_portfolio_owner()));
drop policy if exists "Activity log is managed by the admin" on public.activity_log;
create policy "Owner manages activity log" on public.activity_log for all to authenticated using ((select private.is_portfolio_owner())) with check ((select private.is_portfolio_owner()));

-- profiles: the profile row also stores review submissions (with reviewer emails) and contact details, so it is
-- no longer readable through the public API key. The site reads it through the server.
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Profiles are modifiable by authenticated users." on public.profiles;
create policy "Owner manages profile" on public.profiles for all to authenticated using ((select private.is_portfolio_owner())) with check ((select private.is_portfolio_owner()));

-- ---------- Public content tables: everyone reads, only the owner edits ----------

drop policy if exists "Projects are modifiable by authenticated users." on public.projects;
create policy "Owner edits projects" on public.projects for all to authenticated using ((select private.is_portfolio_owner())) with check ((select private.is_portfolio_owner()));

drop policy if exists "Certificates are modifiable by authenticated users." on public.certificates;
create policy "Owner edits certificates" on public.certificates for all to authenticated using ((select private.is_portfolio_owner())) with check ((select private.is_portfolio_owner()));

drop policy if exists "Project gallery modifiable by authenticated users." on public.project_gallery;
create policy "Owner edits project gallery" on public.project_gallery for all to authenticated using ((select private.is_portfolio_owner())) with check ((select private.is_portfolio_owner()));

drop policy if exists "Skills are modifiable by authenticated users." on public.skills;
create policy "Owner edits skills" on public.skills for all to authenticated using ((select private.is_portfolio_owner())) with check ((select private.is_portfolio_owner()));

drop policy if exists "Testimonials modifiable by authenticated users." on public.testimonials;
create policy "Owner manages testimonials" on public.testimonials for all to authenticated using ((select private.is_portfolio_owner())) with check ((select private.is_portfolio_owner()));
