-- Initial content for public.public_knowledge_base (the AI assistant's only source of facts).
-- Published rows are drawn from the existing site copy and project write-ups. Rows marked is_published = false are
-- drafts that need Abdulwahab's real details (prices, process, availability) before the assistant may use them;
-- publish them from the admin dashboard or with: update public.public_knowledge_base set is_published = true where ...
-- Safe to re-run: it replaces every row whose title it defines.

delete from public.public_knowledge_base where title in (
  'Who Abdulwahab is', 'How to get in touch', 'From solar engineering to software', 'How he approaches work',
  'Tech stack', 'Services', 'Voltway Electrical (demo)', 'Amāra Beauty Lounge (demo)', 'RedFine (demo)',
  'Velocity Rentals (demo)', 'Azure Haven Hotel (demo)', 'L''Horizon Royal (demo)', 'Sovereign Grand Hotel (demo)',
  'Agbada Luxe (demo)', 'Shin Orne jewellery store (demo)', 'AI Outreach (internal tool)', 'About these projects',
  'Security and data handling', 'Booking, payments and admin dashboards', 'Solar and renewable energy work',
  'Pricing approach', 'Price ranges', 'How a project runs', 'Availability and response time', 'Work history',
  'Education', 'Location and time zone', 'Maintenance after launch'
);

insert into public.public_knowledge_base (category, title, content, keywords, always_include, is_published, sort_order) values

-- ---------- Core (sent with every question) ----------
('bio', 'Who Abdulwahab is',
 $kb$Abdulwahab Abdullahi is a self-taught full-stack web developer with a background in solar engineering. He works freelance, building fast, secure, responsive websites and web applications for businesses, with a focus on clean code, careful design and reliable backends. He is also experienced with solar and off-grid power systems.$kb$,
 'about developer freelancer full-stack web developer solar engineer who are you', true, true, 1),

('contact', 'How to get in touch',
 $kb$The best way to start a project or ask a detailed question is the contact form on the Contact page (/contact). Abdulwahab reads every message himself and replies personally. Email: abdulwahababdullah3619@gmail.com. Code: github.com/abdul3619. LinkedIn is linked from the site.$kb$,
 'contact email hire reach message talk call book a call get in touch github linkedin', true, true, 2),

-- ---------- Background and approach ----------
('bio', 'From solar engineering to software',
 $kb$Before moving into software, Abdulwahab worked hands-on with solar installations. Troubleshooting electrical systems taught him to approach problems systematically, and he applies the same methodical diagnostics to debugging code and backend logic. He learned to code without a formal computer science degree, by reading documentation and source code and building real software from scratch, which is why he picks up new technologies quickly.$kb$,
 'background story journey self-taught degree education career change solar', false, true, 10),

('process', 'How he approaches work',
 $kb$Abdulwahab cares about precision and finish: pixel-accurate layouts, type-safe and readable code, optimised assets and fast pages. He prefers minimal, intuitive interfaces with clear typography and small, purposeful animations rather than visual clutter. He treats learning as part of the job and keeps up with modern tools and patterns.$kb$,
 'approach values quality design philosophy detail performance clean code minimal', false, true, 11),

('service', 'Tech stack',
 $kb$Frontend: React, Next.js, TypeScript, JavaScript, Tailwind CSS, Framer Motion, Vite, HTML and CSS. Backend: Node.js, Express, REST and GraphQL APIs. Databases: PostgreSQL, Supabase, Prisma, Drizzle, MongoDB, Firebase. Tooling and hosting: Git, GitHub Actions, Docker, Google Cloud Run, Vercel and Render.$kb$,
 'technologies stack languages frameworks react nextjs typescript node express postgres supabase firebase tailwind docker vercel render',
 false, true, 12),

('service', 'Services',
 $kb$Abdulwahab builds business websites and full web applications: marketing sites, booking and reservation systems, online stores, admin dashboards and content management, and internal tools. He handles the whole build, from design and frontend to the backend, database, security and deployment. He can also advise on solar and renewable energy systems.$kb$,
 'services what do you do offer build website web app booking store ecommerce dashboard cms internal tool hire',
 false, true, 13),

('faq', 'Booking, payments and admin dashboards',
 $kb$Several of Abdulwahab's demos include working booking or request forms that save to a real database (for example RedFine, Voltway Electrical and Agbada Luxe), and admin dashboards for managing content, bookings and messages. Payment screens in the demos are mock-ups; real payment integration is planned for upcoming versions of the flagship demos.$kb$,
 'booking reservation appointment payments stripe checkout admin dashboard cms manage content',
 false, true, 20),

('faq', 'Security and data handling',
 $kb$Security is built in from the start: secrets stay on the server, databases use row level security so visitors can only reach what they should, forms are validated on the server, and admin areas sit behind proper login with rate limiting. This assistant itself can only read a small set of public information about Abdulwahab and his work.$kb$,
 'security safe data privacy login protection rls secure',
 false, true, 21),

('faq', 'Solar and renewable energy work',
 $kb$Alongside software, Abdulwahab has hands-on experience with solar installations: system diagnostics, inverter configuration, battery storage and off-grid or hybrid setups. For solar questions, the contact form is the best place to describe the site and the power needs.$kb$,
 'solar panels inverter battery off-grid renewable energy installation power',
 false, true, 22),

-- ---------- Projects ----------
('project', 'About these projects',
 $kb$The projects in the portfolio are demonstration builds for fictional brands, made to show what Abdulwahab can build for a real business. Names, prices and reviews on those demo sites are illustrative. The full list with live demos is on the Projects page (/projects).$kb$,
 'projects portfolio demos examples case studies clients real work', false, true, 30),

('project', 'Voltway Electrical (demo)',
 $kb$A website for a demo electrician brand: domestic, commercial and 24/7 emergency services, a filterable completed-jobs gallery, an accreditations section, advice articles and a quote request form that saves to Supabase with spam protection. Built with React, TypeScript, Tailwind and Vite, prerendered for speed and SEO. Live demo: https://crouch-end.vercel.app$kb$,
 'electrician electrical trades quote form gallery emergency services local business', false, true, 31),

('project', 'Amāra Beauty Lounge (demo)',
 $kb$A bilingual English/Arabic beauty salon website with an interactive booking calendar (Google sign-in and Firestore), saved booking progress, and email notifications to the owner. Live demo: https://lamasat-al-joud.vercel.app$kb$,
 'salon beauty booking calendar appointments arabic bilingual firebase firestore', false, true, 32),

('project', 'RedFine (demo)',
 $kb$A bilingual English/Arabic site for a men's grooming studio: a service menu with prices and durations, membership plans, and an online booking form that saves requests to Supabase. Live demo: https://redfine.vercel.app$kb$,
 'barber grooming salon booking form memberships pricing arabic bilingual supabase', false, true, 33),

('project', 'Velocity Rentals (demo)',
 $kb$A bilingual car rental website with a swipeable photo gallery for each car, fleet filters, rental requirements, and a booking request flow that remembers where the visitor left off. Live demo: https://valcar-rental.vercel.app$kb$,
 'car rental vehicles fleet gallery booking arabic bilingual', false, true, 34),

('project', 'Azure Haven Hotel (demo)',
 $kb$A luxury hotel site with room browsing, a booking search, bookable special offers that pre-fill the search, a photo gallery and policy pages. Live demo: https://hotel-demo-ruby.vercel.app$kb$,
 'hotel resort rooms booking offers hospitality', false, true, 35),

('project', 'L''Horizon Royal (demo)',
 $kb$A bilingual English/French hotel booking site with suite listings, amenities checklists and photo galleries per room, stay packages, and a booking flow that remembers the planned stay. Live demo: https://horizon-br6n.vercel.app$kb$,
 'hotel suites booking packages french bilingual hospitality', false, true, 36),

('project', 'Sovereign Grand Hotel (demo)',
 $kb$A hotel platform with a full backend: guests browse rooms and book, then manage bookings, invoices and notifications in a guest portal; staff use a role-based dashboard (super admin, manager, receptionist, accountant) for rooms, bookings, customers and payments. React frontend, Express and PostgreSQL API, Firebase sign-in.$kb$,
 'hotel management platform guest portal staff dashboard roles bookings invoices express postgres', false, true, 37),

('project', 'Agbada Luxe (demo)',
 $kb$A bespoke tailoring house website with a product collection managed from a secure admin dashboard (image uploads, bookings, newsletter), consultation booking with optional body measurements, a size guide and a seasonal lookbook. Built on Supabase with row level security.$kb$,
 'fashion tailoring clothing bespoke measurements consultation admin cms supabase', false, true, 38),

('project', 'Shin Orne jewellery store (demo)',
 $kb$An online jewellery store with collections, ring sizing and engraving options, a cart that persists between visits, and a demo checkout with card, Google Pay, Apple Pay and PayPal screens (payments are mocked). Admin dashboard for products and orders. Live demo: https://shin-orne.vercel.app$kb$,
 'ecommerce store shop jewellery cart checkout products orders', false, false, 39),

('project', 'AI Outreach (internal tool)',
 $kb$A private, password-protected tool Abdulwahab built for his own client outreach. It finds local businesses, audits their websites (respecting robots.txt), and drafts a personalised email per lead with Gemini, which he reviews and sends himself. Nothing is sent automatically. Code: https://github.com/Abdul3619/AI-OUTREACH$kb$,
 'ai automation outreach tool gemini internal private crawler', false, true, 40),

-- ---------- Drafts: need Abdulwahab's real details before publishing ----------
('pricing', 'Pricing approach',
 $kb$DRAFT: Every project is quoted individually after a short conversation about scope, features and timeline. Small business websites cost less than full web applications with accounts, bookings or payments. The quickest way to get a number is to describe the project in the contact form.$kb$,
 'price cost how much budget quote rate charge fee', false, false, 50),

('pricing', 'Price ranges',
 $kb$DRAFT - fill in real figures: Business website from [amount]. Booking or e-commerce site from [amount]. Custom web application from [amount]. Ongoing maintenance from [amount] per month.$kb$,
 'price cost how much budget range starting from', false, false, 51),

('process', 'How a project runs',
 $kb$DRAFT - confirm: 1) Short call or message exchange to understand the business and goals. 2) Written scope and quote with milestones. 3) Design and build with regular previews. 4) Launch, handover and a support period.$kb$,
 'process steps timeline how long workflow milestones', false, false, 52),

('faq', 'Availability and response time',
 $kb$DRAFT - fill in: current availability for new projects, typical reply time, and typical timeline for a small site versus a larger app.$kb$,
 'available availability start when timeline how long reply response', false, false, 53),

('faq', 'Location and time zone',
 $kb$DRAFT - fill in: where Abdulwahab is based (country only) and which time zones and countries he works with.$kb$,
 'location where based country time zone remote international', false, false, 54),

('faq', 'Maintenance after launch',
 $kb$DRAFT - fill in: whether support and maintenance are offered after launch, and on what terms.$kb$,
 'maintenance support updates after launch hosting', false, false, 55),

('bio', 'Work history',
 $kb$DRAFT - confirm accuracy before publishing (taken from the resume page, which may hold placeholder data): Freelance full-stack developer since 2023. Previously a solar engineering technician (2020 to 2023).$kb$,
 'experience work history jobs employer resume cv', false, false, 56),

('bio', 'Education',
 $kb$DRAFT - confirm accuracy before publishing (taken from the resume page, which may hold placeholder data): Self-directed computer science study since 2022; diploma in renewable energy (2018 to 2020).$kb$,
 'education diploma degree study qualifications certificates', false, false, 57);
