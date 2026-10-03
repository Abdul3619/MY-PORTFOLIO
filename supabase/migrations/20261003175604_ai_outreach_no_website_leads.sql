-- Lets AI Outreach discover and draft for businesses that have no website at
-- all -- WhatsApp/Facebook/Instagram/phone-only -- not just businesses OSM
-- already tagged with a website. `website` becomes optional; a business now
-- always has a contact_channel ('website' | 'whatsapp' | 'facebook' |
-- 'instagram' | 'phone') and, for the non-website channels, a contact_value
-- holding the actual number/handle/URL.
--
-- Applied directly to the ai-outreach schema (see outreach/store.ts's header
-- comment -- that schema lives in Supabase, not as migrations in this repo,
-- since the tool predates being merged into this portfolio). This file
-- mirrors what was actually run, for the repo's own history.

ALTER TABLE ai_outreach_businesses
  ALTER COLUMN website DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS contact_channel text NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS contact_value text;

ALTER TABLE ai_outreach_businesses
  ADD CONSTRAINT ai_outreach_businesses_contact_channel_check
    CHECK (contact_channel IN ('website', 'whatsapp', 'facebook', 'instagram', 'phone')),
  ADD CONSTRAINT ai_outreach_businesses_contact_value_check
    CHECK (
      (contact_channel = 'website' AND website IS NOT NULL)
      OR (contact_channel <> 'website' AND contact_value IS NOT NULL)
    );

CREATE OR REPLACE FUNCTION public.ai_outreach_upsert_business(
  p_domain text,
  p_website text,
  p_name text DEFAULT NULL::text,
  p_city text DEFAULT NULL::text,
  p_country text DEFAULT NULL::text,
  p_contact_channel text DEFAULT 'website'::text,
  p_contact_value text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_domain TEXT := lower(trim(p_domain));
  v_channel TEXT := COALESCE(NULLIF(trim(p_contact_channel), ''), 'website');
  v_row ai_outreach_businesses;
BEGIN
  PERFORM ai_outreach_require_key();
  IF v_domain IS NULL OR v_domain = '' THEN
    RAISE EXCEPTION 'domain is required';
  END IF;
  IF v_channel NOT IN ('website', 'whatsapp', 'facebook', 'instagram', 'phone') THEN
    RAISE EXCEPTION 'invalid contact channel: %', v_channel;
  END IF;
  IF v_channel = 'website' THEN
    IF p_website IS NULL OR trim(p_website) = '' THEN
      RAISE EXCEPTION 'website is required';
    END IF;
  ELSE
    IF p_contact_value IS NULL OR trim(p_contact_value) = '' THEN
      RAISE EXCEPTION 'contact_value is required for channel %', v_channel;
    END IF;
  END IF;

  INSERT INTO ai_outreach_businesses (domain, website, name, city, country, contact_channel, contact_value)
  VALUES (v_domain, NULLIF(trim(p_website), ''), NULLIF(trim(p_name), ''), NULLIF(trim(p_city), ''), NULLIF(trim(p_country), ''), v_channel, NULLIF(trim(p_contact_value), ''))
  ON CONFLICT (domain) DO UPDATE SET
    name = COALESCE(ai_outreach_businesses.name, EXCLUDED.name),
    city = COALESCE(ai_outreach_businesses.city, EXCLUDED.city),
    country = COALESCE(ai_outreach_businesses.country, EXCLUDED.country)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'domain', v_row.domain,
    'website', v_row.website,
    'name', v_row.name,
    'city', v_row.city,
    'country', v_row.country,
    'contactChannel', v_row.contact_channel,
    'contactValue', v_row.contact_value,
    'createdAt', v_row.created_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_outreach_get_lead(p_lead_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM ai_outreach_require_key();
  SELECT jsonb_build_object(
    'id', l.id,
    'businessId', l.business_id,
    'domain', b.domain,
    'website', b.website,
    'contactChannel', b.contact_channel,
    'contactValue', b.contact_value,
    'businessName', b.name,
    'city', b.city,
    'country', b.country,
    'source', l.source,
    'status', l.status,
    'error', l.error,
    'evidence', l.evidence,
    'draftSubject', l.draft_subject,
    'draftBody', l.draft_body,
    'createdAt', l.created_at,
    'updatedAt', l.updated_at
  ) INTO v_result
  FROM ai_outreach_leads l
  JOIN ai_outreach_businesses b ON b.id = l.business_id
  WHERE l.id = p_lead_id;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_outreach_list_leads(p_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM ai_outreach_require_key();
  SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'id')::BIGINT DESC), '[]'::JSONB)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', l.id,
      'businessId', l.business_id,
      'domain', b.domain,
      'website', b.website,
      'contactChannel', b.contact_channel,
      'contactValue', b.contact_value,
      'businessName', b.name,
      'city', b.city,
      'country', b.country,
      'source', l.source,
      'status', l.status,
      'error', l.error,
      'evidence', l.evidence,
      'draftSubject', l.draft_subject,
      'draftBody', l.draft_body,
      'createdAt', l.created_at,
      'updatedAt', l.updated_at
    ) AS row_data
    FROM ai_outreach_leads l
    JOIN ai_outreach_businesses b ON b.id = l.business_id
    WHERE p_status IS NULL OR l.status = p_status
  ) t;

  RETURN v_result;
END;
$function$;
