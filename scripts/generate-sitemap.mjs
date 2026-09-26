import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  // Remove trailing slashes
  return url.replace(/\/+$/, '');
}

// 2. Extract routes from App.tsx
function extractRoutesFromApp() {
  const appPath = path.join(rootDir, 'src', 'App.tsx');
  if (!fs.existsSync(appPath)) {
    console.warn(`[sitemap-generator] Warning: src/App.tsx not found at ${appPath}`);
    return ['/', '/about', '/skills', '/projects', '/solar-estimator', '/certificates', '/testimonials', '/resume', '/contact'];
  }

  const content = fs.readFileSync(appPath, 'utf-8');
  // Match path="..." or path='...'
  const routeRegex = /<Route\s+[^>]*path=["']([^"']+)["']/g;
  const rawRoutes = new Set();
  let match;

  while ((match = routeRegex.exec(content)) !== null) {
    const routePath = match[1];
    rawRoutes.add(routePath);
  }

  console.log(`[sitemap-generator] Found raw routes in App.tsx:`, Array.from(rawRoutes));
  return Array.from(rawRoutes);
}

// 3. Extract project IDs / slugs from src/data/projects.ts
function extractProjectSlugs() {
  const projectsDataPath = path.join(rootDir, 'src', 'data', 'projects.ts');
  const slugs = new Set([
    'luxury-hotel',
    'hotel-booking',
    'salon-website',
    'car-rental',
    'mechanic',
    'fashion-designer'
  ]);

  if (fs.existsSync(projectsDataPath)) {
    try {
      const content = fs.readFileSync(projectsDataPath, 'utf-8');
      // Match id: "..." or id: '...' inside project objects
      const idRegex = /id:\s*["']([^"']+)["']/g;
      let match;
      while ((match = idRegex.exec(content)) !== null) {
        if (match[1]) {
          slugs.add(match[1]);
        }
      }
    } catch (err) {
      console.warn(`[sitemap-generator] Could not parse projects.ts: ${err.message}`);
    }
  }

  return Array.from(slugs);
}

// 4. Fetch Supabase projects if credentials are present at build time
async function fetchSupabaseProjectSlugs() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    return [];
  }

  try {
    const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/projects?select=slug,status&status=eq.Published`;
    const res = await fetch(endpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((p) => p.slug).filter(Boolean);
      }
    }
  } catch (err) {
    console.warn(`[sitemap-generator] Note: Supabase project fetch skipped or failed: ${err.message}`);
  }

  return [];
}

// 5. Build sitemap URL entries
async function buildSitemapEntries() {
  const baseUrl = getBaseUrl();
  const rawRoutes = extractRoutesFromApp();
  const today = new Date().toISOString().split('T')[0];

  const staticProjectSlugs = extractProjectSlugs();
  const dbProjectSlugs = await fetchSupabaseProjectSlugs();
  const allProjectSlugs = Array.from(new Set([...staticProjectSlugs, ...dbProjectSlugs]));

  const entries = [];
  const processedPaths = new Set();

  for (const route of rawRoutes) {
    // Exclude admin, wildcards, and special paths
    if (route.startsWith('/admin') || route === '*' || route === '') {
      continue;
    }

    if (route.includes(':id') || route.includes(':slug')) {
      // Expand parameterized project route
      for (const slug of allProjectSlugs) {
        const expandedPath = route.replace(/:id|:slug/g, slug);
        if (!processedPaths.has(expandedPath)) {
          processedPaths.add(expandedPath);
          entries.push({
            loc: `${baseUrl}${expandedPath}`,
            lastmod: today,
            changefreq: 'monthly',
            priority: '0.8'
          });
        }
      }
    } else {
      // Standard static route
      const cleanPath = route === '/' ? '' : route;
      const fullUrl = `${baseUrl}${cleanPath}`;
      if (!processedPaths.has(route)) {
        processedPaths.add(route);

        let priority = '0.8';
        let changefreq = 'monthly';

        if (route === '/') {
          priority = '1.0';
          changefreq = 'weekly';
        } else if (route === '/projects') {
          priority = '0.9';
          changefreq = 'weekly';
        } else if (route === '/certificates' || route === '/testimonials') {
          priority = '0.7';
          changefreq = 'monthly';
        } else {
          priority = '0.8';
          changefreq = 'monthly';
        }

        entries.push({
          loc: fullUrl,
          lastmod: today,
          changefreq,
          priority
        });
      }
    }
  }

  // Ensure default core routes are present even if regex parsing missed anything
  const coreRoutes = [
    { path: '/', priority: '1.0', changefreq: 'weekly' },
    { path: '/about', priority: '0.8', changefreq: 'monthly' },
    { path: '/skills', priority: '0.8', changefreq: 'monthly' },
    { path: '/projects', priority: '0.9', changefreq: 'weekly' },
    { path: '/solar-estimator', priority: '0.8', changefreq: 'monthly' },
    { path: '/certificates', priority: '0.7', changefreq: 'monthly' },
    { path: '/testimonials', priority: '0.7', changefreq: 'monthly' },
    { path: '/resume', priority: '0.8', changefreq: 'monthly' },
    { path: '/contact', priority: '0.8', changefreq: 'monthly' }
  ];

  for (const core of coreRoutes) {
    if (!processedPaths.has(core.path)) {
      processedPaths.add(core.path);
      entries.push({
        loc: `${baseUrl}${core.path === '/' ? '' : core.path}`,
        lastmod: today,
        changefreq: core.changefreq,
        priority: core.priority
      });
    }
  }

  // Ensure projects are present if not already added
  for (const slug of allProjectSlugs) {
    const projectPath = `/projects/${slug}`;
    if (!processedPaths.has(projectPath)) {
      processedPaths.add(projectPath);
      entries.push({
        loc: `${baseUrl}${projectPath}`,
        lastmod: today,
        changefreq: 'monthly',
        priority: '0.8'
      });
    }
  }

  return entries;
}

// 6. Generate XML content
function generateXml(entries) {
  const urlTags = entries
    .map(
      (entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlTags}
</urlset>
`;
}

// 7. Generate robots.txt
function generateRobotsTxt(baseUrl) {
  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/*
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
`;
}

// Main execution
async function main() {
  console.log('[sitemap-generator] Starting sitemap.xml generation...');
  const baseUrl = getBaseUrl();
  console.log(`[sitemap-generator] Base URL: ${baseUrl}`);

  const entries = await buildSitemapEntries();
  const xml = generateXml(entries);
  const robotsTxt = generateRobotsTxt(baseUrl);

  // Write to public directory (Vite automatically copies public/ into dist/ during build)
  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const publicSitemapPath = path.join(publicDir, 'sitemap.xml');
  const publicRobotsPath = path.join(publicDir, 'robots.txt');

  fs.writeFileSync(publicSitemapPath, xml, 'utf-8');
  fs.writeFileSync(publicRobotsPath, robotsTxt, 'utf-8');
  console.log(`[sitemap-generator] Wrote ${entries.length} URLs to ${publicSitemapPath}`);
  console.log(`[sitemap-generator] Wrote robots.txt to ${publicRobotsPath}`);

  // If dist directory exists, write directly there as well
  const distDir = path.join(rootDir, 'dist');
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml, 'utf-8');
    fs.writeFileSync(path.join(distDir, 'robots.txt'), robotsTxt, 'utf-8');
    console.log(`[sitemap-generator] Copied sitemap.xml & robots.txt to ${distDir}`);
  }

  console.log('[sitemap-generator] Successfully generated sitemap.xml and robots.txt!');
}

main().catch((err) => {
  console.error('[sitemap-generator] Fatal error during sitemap generation:', err);
  process.exit(1);
});
