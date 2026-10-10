-- AI Outreach: drafts are written in the business's own language (e.g. French for Benin). The English copy and
-- the language used are kept next to the draft in one jsonb column: { language, languageCode, subjectEnglish,
-- bodyEnglish }. Null for drafts that were written in English to begin with.

alter table public.ai_outreach_leads add column if not exists draft_translation jsonb;

create or replace function public.ai_outreach_get_lead(p_lead_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result jsonb;
begin
  perform ai_outreach_require_key();
  select jsonb_build_object(
    'id', l.id,
    'businessId', l.business_id,
    'domain', b.domain,
    'website', b.website,
    'contactChannel', b.contact_channel,
    'contactValue', b.contact_value,
    'fallbackPhone', b.fallback_phone,
    'businessName', b.name,
    'city', b.city,
    'country', b.country,
    'source', l.source,
    'status', l.status,
    'error', l.error,
    'evidence', l.evidence,
    'draftSubject', l.draft_subject,
    'draftBody', l.draft_body,
    'draftTranslation', l.draft_translation,
    'visualAudit', l.visual_audit,
    'createdAt', l.created_at,
    'updatedAt', l.updated_at
  ) into v_result
  from ai_outreach_leads l
  join ai_outreach_businesses b on b.id = l.business_id
  where l.id = p_lead_id;

  return v_result;
end;
$function$;

create or replace function public.ai_outreach_list_leads(p_status text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result jsonb;
begin
  perform ai_outreach_require_key();
  select coalesce(jsonb_agg(row_data order by (row_data->>'id')::bigint desc), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', l.id,
      'businessId', l.business_id,
      'domain', b.domain,
      'website', b.website,
      'contactChannel', b.contact_channel,
      'contactValue', b.contact_value,
      'fallbackPhone', b.fallback_phone,
      'businessName', b.name,
      'city', b.city,
      'country', b.country,
      'source', l.source,
      'status', l.status,
      'error', l.error,
      'evidence', l.evidence,
      'draftSubject', l.draft_subject,
      'draftBody', l.draft_body,
      'draftTranslation', l.draft_translation,
      'visualAudit', l.visual_audit,
      'createdAt', l.created_at,
      'updatedAt', l.updated_at
    ) as row_data
    from ai_outreach_leads l
    join ai_outreach_businesses b on b.id = l.business_id
    where p_status is null or l.status = p_status
  ) t;

  return v_result;
end;
$function$;

create or replace function public.ai_outreach_update_lead(p_lead_id bigint, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status text;
begin
  perform ai_outreach_require_key();
  if p_patch ? 'status' then
    v_status := p_patch->>'status';
    if v_status not in ('crawling','crawl_error','drafting','draft_error','drafted','duplicate','opted_out','approved','rejected','sent') then
      raise exception 'invalid status: %', v_status;
    end if;
  end if;

  update ai_outreach_leads set
    status = case when p_patch ? 'status' then p_patch->>'status' else status end,
    error = case when p_patch ? 'error' then p_patch->>'error' else error end,
    evidence = case when p_patch ? 'evidence' then p_patch->'evidence' else evidence end,
    draft_subject = case when p_patch ? 'draftSubject' then p_patch->>'draftSubject' else draft_subject end,
    draft_body = case when p_patch ? 'draftBody' then p_patch->>'draftBody' else draft_body end,
    draft_translation = case when p_patch ? 'draftTranslation' then p_patch->'draftTranslation' else draft_translation end,
    visual_audit = case when p_patch ? 'visualAudit' then p_patch->'visualAudit' else visual_audit end,
    updated_at = now()
  where id = p_lead_id;

  return ai_outreach_get_lead(p_lead_id);
end;
$function$;
