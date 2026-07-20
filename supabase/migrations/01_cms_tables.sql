-- Add CMS Tables for Portfolio
-- Services
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    tag TEXT,
    order_index INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- About Sections
CREATE TABLE IF NOT EXISTS public.about_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date TEXT,
    icon TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact Information
CREATE TABLE IF NOT EXISTS public.contact_information (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    address TEXT,
    calendly_url TEXT,
    github_url TEXT,
    linkedin_url TEXT,
    twitter_url TEXT,
    instagram_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEO Settings
CREATE TABLE IF NOT EXISTS public.seo_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_title TEXT,
    meta_description TEXT,
    og_image_url TEXT,
    twitter_handle TEXT,
    favicon_url TEXT,
    canonical_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alter Projects table to add more fields if needed
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS long_description TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS tech_stack JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS completion_date TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Completed';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS gallery_images JSONB DEFAULT '[]'::jsonb;

-- Setup RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.about_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_information ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read
CREATE POLICY "Allow public read services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Allow public read about_sections" ON public.about_sections FOR SELECT USING (true);
CREATE POLICY "Allow public read contact_information" ON public.contact_information FOR SELECT USING (true);
CREATE POLICY "Allow public read seo_settings" ON public.seo_settings FOR SELECT USING (true);

-- Provide fallback records for singleton tables
INSERT INTO public.contact_information (email)
SELECT 'hello@example.com'
WHERE NOT EXISTS (SELECT 1 FROM public.contact_information);

INSERT INTO public.seo_settings (site_title)
SELECT 'My Portfolio'
WHERE NOT EXISTS (SELECT 1 FROM public.seo_settings);
