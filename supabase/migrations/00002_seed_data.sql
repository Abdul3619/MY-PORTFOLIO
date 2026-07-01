-- Projects
INSERT INTO public.projects (slug, title, description, thumbnail_url, hero_image_url, live_url, github_url, is_featured, order_index) VALUES 
('luxury-hotel', 'Luxury Hotel Website', 'A premium, high-performance website for a luxury hotel chain. Designed to reflect the opulence of a five-star stay, this luxury hotel website features immersive full-screen imagery, smooth scroll animations, and a seamless booking interface.', 'https://images.unsplash.com/photo-1542314831-c6a4d7429362?q=80&w=1200&auto=format&fit=crop', 'https://images.unsplash.com/photo-1542314831-c6a4d7429362?q=80&w=1200&auto=format&fit=crop', 'https://example.com', 'https://github.com', true, 1),
('hotel-booking', 'Hotel Booking Platform', 'A comprehensive booking platform that handles complex search queries, availability checking, and secure payment processing. The UI focuses on clarity and trust, crucial for a booking application.', 'https://images.unsplash.com/photo-1551882547-ff40eb0d1e73?q=80&w=1200&auto=format&fit=crop', 'https://images.unsplash.com/photo-1551882547-ff40eb0d1e73?q=80&w=1200&auto=format&fit=crop', 'https://example.com', 'https://github.com', true, 2),
('salon-website', 'Premium Salon Website', 'Capturing the aesthetic of a premium beauty brand, this website offers service menus, stylist profiles, and an integrated appointment scheduling system. The design uses soft gradients and elegant typography.', 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1200&auto=format&fit=crop', 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1200&auto=format&fit=crop', 'https://example.com', 'https://github.com', false, 3);

-- Skills
INSERT INTO public.skills (name, category, proficiency, order_index) VALUES 
('React', 'Frontend', 90, 1),
('TypeScript', 'Languages', 85, 2),
('Node.js', 'Backend', 80, 3),
('PostgreSQL', 'Database', 75, 4),
('Tailwind CSS', 'Frontend', 95, 5),
('Solar Installation', 'Hardware', 85, 6);

-- Certificates
INSERT INTO public.certificates (title, issuer, date_issued) VALUES 
('AWS Certified Developer', 'Amazon Web Services', '2023-05-15'),
('Certified Solar Technician', 'NABCEP', '2022-10-10');

-- Testimonials
INSERT INTO public.testimonials (name, role, company, content, is_approved) VALUES 
('Sarah Jenkins', 'CTO', 'TechStart Inc.', 'Abdul delivered our new web application ahead of schedule. His attention to detail and ability to translate our requirements into a working product was exceptional.', true),
('Michael Chen', 'Operations Manager', 'GreenEnergy Solutions', 'The solar monitoring dashboard he built for us completely revolutionized how we track panel efficiency. Highly recommended.', true);
