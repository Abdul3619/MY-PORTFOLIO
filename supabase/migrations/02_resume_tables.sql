CREATE TABLE IF NOT EXISTS public.resume_experience (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    company TEXT NOT NULL,
    period TEXT NOT NULL,
    description TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.resume_education (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    degree TEXT NOT NULL,
    institution TEXT NOT NULL,
    period TEXT NOT NULL,
    description TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.resume_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_education ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read resume_experience" ON public.resume_experience FOR SELECT USING (true);
CREATE POLICY "Allow public read resume_education" ON public.resume_education FOR SELECT USING (true);

INSERT INTO public.resume_experience (role, company, period, description, order_index) VALUES 
('Freelance Full Stack Developer', 'Self-Employed', '2023 - Present', 'Designing and developing premium web applications for clients across various industries, focusing on performance, aesthetics, and scalable architectures.', 0),
('Solar Engineering Technician', 'GreenEnergy Solutions', '2020 - 2023', 'Led installation teams for residential and commercial solar arrays. Conducted system diagnostics, inverter configurations, and battery storage setups.', 1);

INSERT INTO public.resume_education (degree, institution, period, description, order_index) VALUES 
('Self-Taught Computer Science', 'Various Platforms (Coursera, Udemy, Docs)', '2022 - Present', 'Rigorous self-directed study covering data structures, algorithms, system design, and modern web frameworks.', 0),
('Diploma in Renewable Energy', 'Technical Institute of Engineering', '2018 - 2020', 'Specialized in solar photovoltaics, electrical fundamentals, and sustainable energy grid integration.', 1);
