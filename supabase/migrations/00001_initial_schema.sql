-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles Table
CREATE TABLE public.profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    bio TEXT NOT NULL,
    profile_image_url TEXT,
    resume_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Projects Table
CREATE TABLE public.projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    thumbnail_url TEXT,
    hero_image_url TEXT,
    live_url TEXT,
    github_url TEXT,
    is_featured BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Project Gallery Table
CREATE TABLE public.project_gallery (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Skills Table
CREATE TABLE public.skills (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    icon TEXT,
    proficiency INTEGER,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Certificates Table
CREATE TABLE public.certificates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    issuer TEXT NOT NULL,
    date_issued DATE,
    certificate_url TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Testimonials Table
CREATE TABLE public.testimonials (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    company TEXT,
    content TEXT NOT NULL,
    image_url TEXT,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Contact Messages Table
CREATE TABLE public.contact_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Visitors Table
CREATE TABLE public.visitors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_visit_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Analytics Events Table
CREATE TABLE public.analytics_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    visitor_id UUID REFERENCES public.visitors(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- e.g., 'page_view', 'project_click', 'resume_download'
    page_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Audit Logs Table
CREATE TABLE public.audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID, -- References auth.users if auth is used
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Setup Row Level Security (RLS)

-- Profiles: public read, authenticated admin write
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles are modifiable by authenticated users." ON public.profiles FOR ALL USING (auth.role() = 'authenticated');

-- Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Projects are viewable by everyone." ON public.projects FOR SELECT USING (true);
CREATE POLICY "Projects are modifiable by authenticated users." ON public.projects FOR ALL USING (auth.role() = 'authenticated');

-- Project Gallery
ALTER TABLE public.project_gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project gallery viewable by everyone." ON public.project_gallery FOR SELECT USING (true);
CREATE POLICY "Project gallery modifiable by authenticated users." ON public.project_gallery FOR ALL USING (auth.role() = 'authenticated');

-- Skills
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Skills are viewable by everyone." ON public.skills FOR SELECT USING (true);
CREATE POLICY "Skills are modifiable by authenticated users." ON public.skills FOR ALL USING (auth.role() = 'authenticated');

-- Certificates
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Certificates are viewable by everyone." ON public.certificates FOR SELECT USING (true);
CREATE POLICY "Certificates are modifiable by authenticated users." ON public.certificates FOR ALL USING (auth.role() = 'authenticated');

-- Testimonials
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
-- Public can view ONLY approved testimonials
CREATE POLICY "Approved testimonials are viewable by everyone." ON public.testimonials FOR SELECT USING (is_approved = true);
-- Public can insert new testimonials
CREATE POLICY "Anyone can submit testimonials." ON public.testimonials FOR INSERT WITH CHECK (true);
-- Authenticated users can do everything (including view unapproved)
CREATE POLICY "Testimonials modifiable by authenticated users." ON public.testimonials FOR ALL USING (auth.role() = 'authenticated');

-- Contact Messages
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
-- Anyone can insert a contact message
CREATE POLICY "Anyone can submit contact messages." ON public.contact_messages FOR INSERT WITH CHECK (true);
-- Only authenticated users can view/update/delete
CREATE POLICY "Messages viewable by authenticated users." ON public.contact_messages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Messages modifiable by authenticated users." ON public.contact_messages FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Messages deletable by authenticated users." ON public.contact_messages FOR DELETE USING (auth.role() = 'authenticated');

-- Visitors
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert visitor data" ON public.visitors FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update their visitor data" ON public.visitors FOR UPDATE USING (true);
CREATE POLICY "Visitors viewable by authenticated users." ON public.visitors FOR SELECT USING (auth.role() = 'authenticated');

-- Analytics Events
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert analytics data" ON public.analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Analytics viewable by authenticated users." ON public.analytics_events FOR SELECT USING (auth.role() = 'authenticated');

-- Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit logs insertable by authenticated users." ON public.audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Audit logs viewable by authenticated users." ON public.audit_logs FOR SELECT USING (auth.role() = 'authenticated');

-- Seed initial profile
INSERT INTO public.profiles (name, title, bio) VALUES (
    'Abdul Wahab',
    'Web Developer & Solar Technician',
    'I build fast, responsive web applications and implement reliable solar solutions.'
);
