ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS long_bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

ALTER TABLE public.contact_information ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.contact_information ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE public.contact_information ADD COLUMN IF NOT EXISTS behance_url TEXT;
ALTER TABLE public.contact_information ADD COLUMN IF NOT EXISTS dribbble_url TEXT;
ALTER TABLE public.contact_information ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE public.contact_information ADD COLUMN IF NOT EXISTS discord_url TEXT;

ALTER TABLE public.seo_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.seo_settings ADD COLUMN IF NOT EXISTS site_name TEXT;
ALTER TABLE public.seo_settings ADD COLUMN IF NOT EXISTS footer_copyright TEXT;
ALTER TABLE public.seo_settings ADD COLUMN IF NOT EXISTS browser_title TEXT;
ALTER TABLE public.seo_settings ADD COLUMN IF NOT EXISTS meta_keywords TEXT;
ALTER TABLE public.seo_settings ADD COLUMN IF NOT EXISTS twitter_card_image TEXT;
ALTER TABLE public.seo_settings ADD COLUMN IF NOT EXISTS google_analytics_id TEXT;
ALTER TABLE public.seo_settings ADD COLUMN IF NOT EXISTS google_tag_manager_id TEXT;
ALTER TABLE public.seo_settings ADD COLUMN IF NOT EXISTS microsoft_clarity_id TEXT;
ALTER TABLE public.seo_settings ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT;
ALTER TABLE public.seo_settings ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT false;
