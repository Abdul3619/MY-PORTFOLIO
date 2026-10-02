-- One-time data fix: the Azure Hotel and H`orizon hotel project rows had their whole admin-form payload
-- (description + a "---METADATA---" JSON blob with category/status/views/tags/caseStudy/gallery) saved into the
-- single `description` column, instead of the real columns (description, long_description, tags, tech_stack,
-- gallery_images). This meant the raw JSON blob was being fed straight to the AI assistant's knowledge of these
-- two projects instead of a clean description -- exactly the "know it in and out" goal this was supposed to serve.
--
-- This extracts the real values back into their proper columns. Nothing destructive: the extraction was verified
-- with a SELECT before each UPDATE. No other projects were affected (checked via `description like
-- '%---METADATA---%'` across the table).
--
-- Root cause is in src/pages/admin/AdminProjects.tsx (handleSaveProject), which still builds this same
-- "compositeDescription" today even though status/tags/tech_stack/long_description are real columns on
-- public.projects -- so this exact corruption will recur for any project edited through that form until that
-- function is fixed to write each field to its own column instead of stuffing them into `description`.

update public.projects
set
  description = split_part((description::jsonb)->>'description', E'\n\n---METADATA---\n', 1),
  long_description = (split_part((description::jsonb)->>'description', E'\n\n---METADATA---\n', 2)::jsonb)->>'caseStudy',
  tags = (split_part((description::jsonb)->>'description', E'\n\n---METADATA---\n', 2)::jsonb)->'tags',
  tech_stack = (split_part((description::jsonb)->>'description', E'\n\n---METADATA---\n', 2)::jsonb)->'tags',
  gallery_images = (
    select jsonb_agg(jsonb_build_object('url', g.value, 'caption', ''))
    from jsonb_array_elements_text((split_part((description::jsonb)->>'description', E'\n\n---METADATA---\n', 2)::jsonb)->'gallery') as g(value)
  )
where slug = 'Azure-hotel';

update public.projects
set
  description = split_part((description::jsonb)->>'description', E'\n\n---METADATA---\n', 1),
  long_description = (split_part((description::jsonb)->>'description', E'\n\n---METADATA---\n', 2)::jsonb)->>'caseStudy',
  tags = (split_part((description::jsonb)->>'description', E'\n\n---METADATA---\n', 2)::jsonb)->'tags',
  tech_stack = (split_part((description::jsonb)->>'description', E'\n\n---METADATA---\n', 2)::jsonb)->'tags',
  gallery_images = (split_part((description::jsonb)->>'description', E'\n\n---METADATA---\n', 2)::jsonb)->'gallery'
where slug = 'h-orizon-hotel';
