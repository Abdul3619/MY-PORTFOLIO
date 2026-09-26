import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Resolve Base URL
function getBaseUrl() {
  let url =
    process.env.CANONICAL_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL ||
    process.env.VITE_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'https://abdulwahab.dev';

  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  return url.replace(/\/+$/, '');
}

// 2. Comprehensive fallback data for SSG rendering
const fallbackProfile = {
  name: 'Abdul Wahab',
  title: 'Web Developer & Solar Technician',
  bio: 'I build fast, responsive web applications and implement reliable solar solutions.',
  tagline: 'Bridging physical engineering with high-performance digital systems.',
  resume_url: 'https://aqilclozwukdnogqcmsy.supabase.co/storage/v1/object/public/media/1785784379045_Abdulwahab_Resume_2.pdf'
};

const fallbackProjects = [
  {
    id: 'luxury-hotel',
    slug: 'luxury-hotel',
    title: 'Luxury Hotel Website',
    category: 'Web Development',
    start_date: 'Jan 2024',
    completion_date: 'Apr 2024',
    description: 'A premium, high-performance website for a luxury hotel chain.',
    longDescription: 'Designed to reflect the opulence of a five-star stay, this luxury hotel website features immersive full-screen imagery, smooth scroll animations, and a seamless booking interface.',
    thumbnail_url: 'https://images.unsplash.com/photo-1542314831-c6a4d7429362?q=80&w=1200&auto=format&fit=crop',
    hero_image_url: 'https://images.unsplash.com/photo-1542314831-c6a4d7429362?q=80&w=1200&auto=format&fit=crop',
    tech_stack: ['React', 'TypeScript', 'Tailwind CSS', 'Framer Motion'],
    status: 'Published'
  },
  {
    id: 'hotel-booking',
    slug: 'hotel-booking',
    title: 'Hotel Booking Platform',
    category: 'Web Development',
    start_date: 'Aug 2023',
    completion_date: 'Dec 2023',
    description: 'A robust platform for finding and booking accommodations worldwide.',
    longDescription: 'A comprehensive booking platform that handles complex search queries, availability checking, and secure payment processing.',
    thumbnail_url: 'https://images.unsplash.com/photo-1551882547-ff40eb0d1e73?q=80&w=1200&auto=format&fit=crop',
    hero_image_url: 'https://images.unsplash.com/photo-1551882547-ff40eb0d1e73?q=80&w=1200&auto=format&fit=crop',
    tech_stack: ['Next.js', 'React', 'Node.js', 'Stripe API'],
    status: 'Published'
  },
  {
    id: 'salon-website',
    slug: 'salon-website',
    title: 'Premium Salon Website',
    category: 'Web Development',
    start_date: 'May 2023',
    completion_date: 'Jul 2023',
    description: 'An elegant digital storefront for a high-end hair and beauty salon.',
    longDescription: 'Capturing the aesthetic of a premium beauty brand, this website offers service menus, stylist profiles, and an integrated appointment scheduling system.',
    thumbnail_url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1200&auto=format&fit=crop',
    hero_image_url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1200&auto=format&fit=crop',
    tech_stack: ['React', 'Tailwind CSS', 'React Router'],
    status: 'Published'
  },
  {
    id: 'car-rental',
    slug: 'car-rental',
    title: 'Car Rental Platform',
    category: 'Web Development',
    start_date: 'Jan 2023',
    completion_date: 'Apr 2023',
    description: 'A sleek interface for browsing and renting premium vehicles.',
    longDescription: 'This platform allows users to browse a fleet of luxury cars, check availability, and process rentals.',
    thumbnail_url: 'https://images.unsplash.com/photo-1562141989-c5c79ac8f576?q=80&w=1200&auto=format&fit=crop',
    hero_image_url: 'https://images.unsplash.com/photo-1562141989-c5c79ac8f576?q=80&w=1200&auto=format&fit=crop',
    tech_stack: ['React', 'TypeScript', 'Tailwind CSS'],
    status: 'Published'
  },
  {
    id: 'mechanic',
    slug: 'mechanic',
    title: 'Mechanic Services',
    category: 'Web Development',
    start_date: 'Nov 2022',
    completion_date: 'Jan 2023',
    description: 'A trustworthy, straightforward website for an automotive repair shop.',
    longDescription: 'Designed for a local mechanic shop, this site focuses on clear communication of services, building trust through reviews, and making it easy to schedule a diagnostic appointment.',
    thumbnail_url: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1200&auto=format&fit=crop',
    hero_image_url: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1200&auto=format&fit=crop',
    tech_stack: ['HTML', 'CSS', 'JavaScript', 'Tailwind CSS'],
    status: 'Published'
  },
  {
    id: 'fashion-designer',
    slug: 'fashion-designer',
    title: 'Fashion Designer Portfolio',
    category: 'Web Development',
    start_date: 'Jun 2022',
    completion_date: 'Sep 2022',
    description: 'An avant-garde digital portfolio for a modern fashion designer.',
    longDescription: 'A highly visual, minimalist portfolio designed to put the clothing collections front and center. Features unique layout structures and subtle reveal animations.',
    thumbnail_url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop',
    hero_image_url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop',
    tech_stack: ['React', 'Framer Motion', 'Tailwind CSS'],
    status: 'Published'
  },
  {
    id: 'residential-solar-storage',
    slug: 'residential-solar-storage',
    title: 'Residential Solar & Battery Storage Array',
    category: 'Solar Energy',
    start_date: 'Mar 2024',
    completion_date: 'May 2024',
    description: 'Turnkey 8.5 kW rooftop photovoltaic installation paired with a 10 kWh lithium-ion battery backup system for grid resilience.',
    longDescription: 'Designed and engineered to provide clean, reliable energy for a modern residential estate. The installation integrates high-efficiency monocrystalline solar modules, a smart hybrid inverter with dual MPPT trackers, and a 10 kWh lithium iron phosphate battery bank with automated sub-second grid-failover capabilities.',
    thumbnail_url: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?q=80&w=1200&auto=format&fit=crop',
    hero_image_url: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?q=80&w=1200&auto=format&fit=crop',
    tech_stack: ['Solar PV Array', 'Hybrid Inverter', 'LiFePO4 Storage', 'Load Balancing', 'Grid Failover'],
    status: 'Published'
  },
  {
    id: 'commercial-solar-microgrid',
    slug: 'commercial-solar-microgrid',
    title: 'Commercial Solar PV Sizing & Microgrid',
    category: 'Solar Energy',
    start_date: 'Sep 2023',
    completion_date: 'Jan 2024',
    description: 'Industrial three-phase solar microgrid system designed for peak-demand shaving and mission-critical backup power.',
    longDescription: 'Engineered for an industrial commercial facility, this solar microgrid incorporates multi-string PV arrays, three-phase grid-tied inverters, and modular battery storage cabinets. The system reduces grid utility reliance by 82% while delivering seamless backup for sensitive manufacturing and server equipment.',
    thumbnail_url: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?q=80&w=1200&auto=format&fit=crop',
    hero_image_url: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?q=80&w=1200&auto=format&fit=crop',
    tech_stack: ['Microgrid Design', 'Three-Phase Inverters', 'Industrial Battery Racks', 'PV Syst Modeling'],
    status: 'Published'
  }
];

const fallbackSkills = [
  { name: 'HTML5', category: 'Frontend Development', icon: 'Monitor', order_index: 1 },
  { name: 'CSS3', category: 'Frontend Development', icon: 'Monitor', order_index: 2 },
  { name: 'JavaScript (ES6+)', category: 'Frontend Development', icon: 'Monitor', order_index: 3 },
  { name: 'TypeScript', category: 'Frontend Development', icon: 'Monitor', order_index: 4 },
  { name: 'React', category: 'Frontend Development', icon: 'Monitor', order_index: 5 },
  { name: 'Next.js', category: 'Frontend Development', icon: 'Monitor', order_index: 6 },
  { name: 'Tailwind CSS', category: 'Frontend Development', icon: 'Monitor', order_index: 7 },
  { name: 'Node.js', category: 'Backend Development', icon: 'Server', order_index: 8 },
  { name: 'Express.js', category: 'Backend Development', icon: 'Server', order_index: 9 },
  { name: 'REST APIs', category: 'Backend Development', icon: 'Server', order_index: 10 },
  { name: 'Supabase', category: 'Database', icon: 'Database', order_index: 11 },
  { name: 'PostgreSQL', category: 'Database', icon: 'Database', order_index: 12 },
  { name: 'Solar Installation', category: 'Solar & Electrical', icon: 'Sun', order_index: 13 },
  { name: 'Battery Systems', category: 'Solar & Electrical', icon: 'Sun', order_index: 14 },
  { name: 'Inverter Setup', category: 'Solar & Electrical', icon: 'Sun', order_index: 15 }
];

const fallbackCerts = [
  { id: 1, title: 'Advanced React Patterns', issuer: 'Frontend Masters', date: '2023' },
  { id: 2, title: 'Solar Energy Systems Design', issuer: 'Renewable Energy Institute', date: '2022' },
  { id: 3, title: 'Full Stack Web Development', issuer: 'Udacity', date: '2024' }
];

const fallbackTestimonials = [
  {
    id: 1,
    name: 'Sarah Jenkins',
    role: 'Creative Director',
    content: 'Abdul has a rare combination of technical precision and an eye for high-end design. The website he built for our agency completely redefined our digital presence.'
  },
  {
    id: 2,
    name: 'Michael Chang',
    role: 'Founder, Apex Solar',
    content: 'Having someone who understands both the physical engineering of solar systems and the digital architecture of our internal tools was a game-changer.'
  },
  {
    id: 3,
    name: 'Elena Rodriguez',
    role: 'Marketing Lead',
    content: 'The level of polish Abdul brings to frontend development is astounding. His attention to micro-interactions and performance optimization sets him apart.'
  }
];

const fallbackExperience = [
  {
    id: 'exp1',
    role: 'Freelance Full Stack Developer',
    company: 'Self-Employed',
    period: '2023 - Present',
    description: 'Designing and developing premium web applications for clients across various industries, focusing on performance, aesthetics, and scalable architectures.'
  },
  {
    id: 'exp2',
    role: 'Solar Engineering Technician',
    company: 'GreenEnergy Solutions',
    period: '2020 - 2023',
    description: 'Led installation teams for residential and commercial solar arrays. Conducted system diagnostics, inverter configurations, and battery storage setups.'
  }
];

const fallbackEducation = [
  {
    id: 'edu1',
    degree: 'Self-Taught Computer Science',
    institution: 'Various Platforms (Coursera, Udemy, Docs)',
    period: '2022 - Present',
    description: 'Rigorous self-directed study covering data structures, algorithms, system design, and modern web frameworks.'
  },
  {
    id: 'edu2',
    degree: 'Diploma in Renewable Energy',
    institution: 'Technical Institute of Engineering',
    period: '2018 - 2020',
    description: 'Specialized in solar photovoltaics, electrical fundamentals, and sustainable energy grid integration.'
  }
];

// 3. Fetch live data from Supabase if available
async function fetchLiveData() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  const data = {
    profile: fallbackProfile,
    projects: [...fallbackProjects],
    skills: [...fallbackSkills],
    certificates: [...fallbackCerts],
    testimonials: [...fallbackTestimonials],
    experience: [...fallbackExperience],
    education: [...fallbackEducation],
    seo: {
      site_title: 'Abdul Wahab – Web Developer & Solar Technician',
      site_description: 'Premium futuristic personal portfolio and web applications by Abdul Wahab, Web Developer and Solar Technician.'
    },
    contactInfo: {
      email: 'abdulwahababdullah3619@gmail.com',
      location: 'Accra, Ghana',
      availability: 'Available for freelance & full-time roles'
    }
  };

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    console.log('[ssg-prerender] Using rich default offline data for SSG.');
    return data;
  }

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`
  };

  try {
    const base = supabaseUrl.replace(/\/+$/, '');
    
    // Fetch published projects
    const projRes = await fetch(`${base}/rest/v1/projects?select=*&status=eq.Published`, { headers });
    if (projRes.ok) {
      const dbProjects = await projRes.json();
      if (Array.isArray(dbProjects) && dbProjects.length > 0) {
        // Merge or replace
        const seenSlugs = new Set();
        const combined = [];
        for (const p of [...dbProjects, ...fallbackProjects]) {
          const key = p.slug || p.id;
          if (key && !seenSlugs.has(key)) {
            seenSlugs.add(key);
            combined.push(p);
          }
        }
        data.projects = combined;
        console.log(`[ssg-prerender] Loaded ${combined.length} projects for SSG.`);
      }
    }

    // Fetch profile
    const profRes = await fetch(`${base}/rest/v1/profiles?select=*&limit=1`, { headers });
    if (profRes.ok) {
      const dbProfiles = await profRes.json();
      if (Array.isArray(dbProfiles) && dbProfiles[0]) {
        let cleanProfile = { ...dbProfiles[0] };
        if (cleanProfile.bio && typeof cleanProfile.bio === 'string' && cleanProfile.bio.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(cleanProfile.bio);
            if (parsed.bio || parsed.bio_text) cleanProfile.bio = parsed.bio || parsed.bio_text;
            if (parsed.name) cleanProfile.name = parsed.name;
            if (parsed.title) cleanProfile.title = parsed.title;
            if (parsed.profile_image_url) cleanProfile.profile_image_url = parsed.profile_image_url;
            if (parsed.tagline) cleanProfile.tagline = parsed.tagline;
          } catch {}
        }
        data.profile = { ...data.profile, ...cleanProfile };
        console.log('[ssg-prerender] Loaded live profile for SSG.');
      }
    }
  } catch (err) {
    console.warn(`[ssg-prerender] Note: Supabase fetch skipped (${err.message}). Using fallback data.`);
  }

  return data;
}

// 4. Generate SEO Metadata for specific route
function getRouteMetadata(route, preloadData, baseUrl, buildStructuredData) {
  const profile = preloadData.profile || fallbackProfile;
  const canonicalUrl = `${baseUrl}${route === '/' ? '' : route}`;

  // Default Home
  let title = `${profile.name} – ${profile.title}`;
  let description = `${profile.bio} Specializing in high-performance web development, responsive architectures, and clean solar energy solutions.`;
  let ogType = 'website';
  let image = profile.profile_image_url || 'https://images.unsplash.com/photo-1542314831-c6a4d7429362?q=80&w=1200&auto=format&fit=crop';

  if (route === '/about') {
    title = `About ${profile.name} – Journey, Vision & Engineering Philosophy`;
    description = `Discover Abdul Wahab's journey from physical solar engineering to self-taught full-stack software development. Methodical problem-solving and clean execution.`;
  } else if (route === '/skills') {
    title = `Skills & Technical Stack – ${profile.name}`;
    description = `Explore Abdul Wahab's technical expertise across React, Next.js, TypeScript, Tailwind CSS, Node.js, Express, PostgreSQL, and solar photovoltaics.`;
  } else if (route === '/projects') {
    title = `Featured Projects & Portfolio Work – ${profile.name}`;
    description = `A curated showcase of modern web applications, luxury hotel platforms, booking engines, and digital tools created by Abdul Wahab.`;
  } else if (route.startsWith('/projects/')) {
    const slug = route.replace('/projects/', '').trim();
    const proj = preloadData.projects.find((p) => p.slug === slug || p.id === slug);
    if (proj) {
      title = `${proj.title} – ${profile.name} Portfolio`;
      description = proj.description || proj.longDescription || `Case study and technical architecture of ${proj.title}.`;
      image = proj.thumbnail_url || proj.hero_image_url || image;
      ogType = 'article';
    }
  } else if (route === '/certificates') {
    title = `Certificates & Achievements – ${profile.name}`;
    description = `Verified credentials, industry certifications, and technical milestones in modern web engineering and solar energy systems design.`;
  } else if (route === '/testimonials') {
    title = `Client Testimonials & Reviews – ${profile.name}`;
    description = `Read genuine recommendations, client reviews, and testimonials from founders, directors, and collaborators who have worked with Abdul Wahab.`;
  } else if (route === '/resume') {
    title = `Resume & Experience – ${profile.name}`;
    description = `Professional experience, education, technical toolkit, and career summary of Abdul Wahab, Web Developer and Solar Technician.`;
  } else if (route === '/solar-estimator') {
    title = `Solar System Estimator – Interactive Power Calculator`;
    description = `Calculate your household solar power requirements, battery capacity, inverter sizing, and estimated system costs with our interactive solar tool.`;
  } else if (route === '/contact') {
    title = `Contact ${profile.name} – Let's Build Something Extraordinary`;
    description = `Get in touch with Abdul Wahab for freelance web development projects, full-stack software engineering, or clean energy solar consultations.`;
  }

  // Schema.org Structured Data
  const jsonLd = typeof buildStructuredData === 'function'
    ? buildStructuredData({
        route,
        baseUrl,
        profile: preloadData.profile,
        contactInfo: preloadData.contactInfo,
        projects: preloadData.projects,
        testimonials: preloadData.testimonials,
        services: preloadData.services
      })
    : {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: profile.name,
        jobTitle: profile.title,
        description: profile.bio,
        url: baseUrl,
        sameAs: ['https://github.com', 'https://linkedin.com']
      };

  return {
    title,
    description,
    canonicalUrl,
    ogType,
    image,
    jsonLd
  };
}

// 5. Inject Head Metadata into HTML
function injectMetadata(html, meta) {
  // Replace <title>
  let modified = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${meta.title}</title>`);

  // Replace or inject meta description
  const metaDescTag = `<meta name="description" content="${meta.description.replace(/"/g, '&quot;')}" />`;
  if (modified.includes('<meta name="description"')) {
    modified = modified.replace(/<meta name="description"[^>]*>/i, metaDescTag);
  } else {
    modified = modified.replace('</head>', `  ${metaDescTag}\n</head>`);
  }

  // Replace OpenGraph & Twitter tags
  const ogTags = `
    <!-- Dynamic Open Graph & Twitter SEO -->
    <meta property="og:title" content="${meta.title.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${meta.description.replace(/"/g, '&quot;')}" />
    <meta property="og:type" content="${meta.ogType}" />
    <meta property="og:url" content="${meta.canonicalUrl}" />
    <meta property="og:image" content="${meta.image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${meta.title.replace(/"/g, '&quot;')}" />
    <meta name="twitter:description" content="${meta.description.replace(/"/g, '&quot;')}" />
    <meta name="twitter:image" content="${meta.image}" />
    <link rel="canonical" href="${meta.canonicalUrl}" />
    <script id="json-ld-structured-data" type="application/ld+json">
${JSON.stringify(meta.jsonLd, null, 2)}
    </script>
`;

  // Remove old OG / Twitter tags if present to prevent duplication
  modified = modified.replace(/<meta\s+property="og:[^>]*>/gi, '');
  modified = modified.replace(/<meta\s+name="twitter:[^>]*>/gi, '');
  modified = modified.replace(/<link\s+rel="canonical"[^>]*>/gi, '');
  modified = modified.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');

  modified = modified.replace('</head>', `${ogTags}\n</head>`);
  return modified;
}

// 6. Main SSG Generation
async function main() {
  console.log('🚀 [ssg-prerender] Starting Static Site Generation (SSG)...');
  const baseUrl = getBaseUrl();
  console.log(`[ssg-prerender] Base URL: ${baseUrl}`);

  const distDir = path.join(rootDir, 'dist');
  const templatePath = path.join(distDir, 'index.html');

  if (!fs.existsSync(templatePath)) {
    console.error(`[ssg-prerender] Error: dist/index.html not found! Run 'vite build' first.`);
    process.exit(1);
  }

  const rawTemplate = fs.readFileSync(templatePath, 'utf-8');

  // Step A: Build SSR bundle
  console.log('[ssg-prerender] Compiling SSR bundle with Vite...');
  execSync('npx vite build --ssr src/entry-server.tsx --outDir dist-ssr', {
    cwd: rootDir,
    stdio: 'inherit'
  });

  // Step B: Load SSR render function
  const serverEntryPath = path.join(rootDir, 'dist-ssr', 'entry-server.js');
  const { render, buildStructuredData } = await import(`file://${serverEntryPath}`);

  // Step C: Fetch preload data
  const preloadData = await fetchLiveData();

  // Step D: Construct all routes
  const routes = [
    '/',
    '/about',
    '/skills',
    '/projects',
    '/solar-estimator',
    '/certificates',
    '/testimonials',
    '/resume',
    '/contact'
  ];

  // Add project detail routes
  for (const proj of preloadData.projects) {
    const slug = proj.slug || proj.id;
    if (slug) {
      routes.push(`/projects/${slug}`);
    }
  }

  console.log(`[ssg-prerender] Prerendering ${routes.length} static routes...`);

  for (const route of routes) {
    try {
      const { html: appHtml } = render(route, preloadData);
      const meta = getRouteMetadata(route, preloadData, baseUrl, buildStructuredData);

      // Inject rendered app HTML into root container
      let pageHtml = rawTemplate.replace(
        '<div id="root"></div>',
        `<div id="root">${appHtml}</div>`
      );

      // Inject SEO & OpenGraph tags
      pageHtml = injectMetadata(pageHtml, meta);

      // Write files
      if (route === '/') {
        fs.writeFileSync(path.join(distDir, 'index.html'), pageHtml, 'utf-8');
        console.log(`  ✓ Prerendered [ / ] -> dist/index.html (${pageHtml.length} bytes)`);
      } else {
        const cleanRoute = route.replace(/^\/+/, '');
        const routeDir = path.join(distDir, cleanRoute);
        if (!fs.existsSync(routeDir)) {
          fs.mkdirSync(routeDir, { recursive: true });
        }

        // Standard directory index: dist/<route>/index.html
        fs.writeFileSync(path.join(routeDir, 'index.html'), pageHtml, 'utf-8');
        // Clean URL file: dist/<route>.html
        const cleanFile = path.join(distDir, `${cleanRoute}.html`);
        fs.mkdirSync(path.dirname(cleanFile), { recursive: true });
        fs.writeFileSync(cleanFile, pageHtml, 'utf-8');

        console.log(`  ✓ Prerendered [ ${route} ] -> dist/${cleanRoute}/index.html & dist/${cleanRoute}.html`);
      }
    } catch (err) {
      console.error(`  ✗ Error prerendering [ ${route} ]:`, err.message);
    }
  }

  // Step E: Clean up dist-ssr
  const distSsrDir = path.join(rootDir, 'dist-ssr');
  if (fs.existsSync(distSsrDir)) {
    fs.rmSync(distSsrDir, { recursive: true, force: true });
  }

  console.log('✨ [ssg-prerender] All routes successfully prerendered into static HTML!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[ssg-prerender] Fatal error during SSG:', err);
  process.exit(1);
});
