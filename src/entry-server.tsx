import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { QueryClientProvider, dehydrate, type QueryKey } from '@tanstack/react-query';
import './lib/i18n';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { createQueryClient } from './lib/queryClient';
import { getPageTitle, getRouteMeta, getSiteDescription, getSiteTitle } from './lib/seo';
import { projectsData } from './data/projects';

// Content the server can load for a page. The query keys must match the hooks in src/hooks/useApi.ts
// (the server always renders in English).
export type Resource =
  | { type: 'profile' | 'seo' | 'contact_info' | 'services' | 'skills' | 'projects' | 'certificates' | 'testimonials' | 'about' | 'resume_experience' | 'resume_education' }
  | { type: 'project'; slug: string };

export interface PrefetchEntry {
  key: QueryKey;
  resource: Resource;
}

export interface RoutePlan {
  // 'client' routes (the admin area) are not server-rendered
  kind: 'page' | 'client';
  queries: PrefetchEntry[];
  projectSlug?: string;
  knownRoute: boolean;
}

const LANG = 'en';

const globalQueries: PrefetchEntry[] = [
  { key: ['profile', LANG], resource: { type: 'profile' } },
  { key: ['seo'], resource: { type: 'seo' } },
  { key: ['contact_info'], resource: { type: 'contact_info' } },
  { key: ['services', LANG], resource: { type: 'services' } },
  { key: ['skills', LANG], resource: { type: 'skills' } },
  { key: ['projects', LANG], resource: { type: 'projects' } },
  { key: ['certificates', LANG], resource: { type: 'certificates' } },
  { key: ['testimonials', LANG], resource: { type: 'testimonials' } },
];

const staticRoutes = new Set(['/', '/about', '/skills', '/projects', '/solar-estimator', '/certificates', '/testimonials', '/resume', '/contact']);

export function getRoutePlan(pathname: string): RoutePlan {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  if (path === '/admin' || path.startsWith('/admin/')) {
    return { kind: 'client', queries: [], knownRoute: true };
  }

  // AtelierFit is its own full-screen app (camera access, PWA install) with nothing worth server-rendering.
  if (path === '/atelierfit' || path.startsWith('/atelierfit/')) {
    return { kind: 'client', queries: [], knownRoute: true };
  }

  // StitchBook is a client-rendered desktop app (live CRUD demo) -- nothing worth server-rendering either.
  if (path === '/stitchbook' || path.startsWith('/stitchbook/')) {
    return { kind: 'client', queries: [], knownRoute: true };
  }

  const queries = [...globalQueries];
  if (path === '/about') {
    queries.push({ key: ['about', LANG], resource: { type: 'about' } });
  }
  if (path === '/resume') {
    queries.push({ key: ['resume_experience', LANG], resource: { type: 'resume_experience' } });
    queries.push({ key: ['resume_education', LANG], resource: { type: 'resume_education' } });
  }

  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    const slug = decodeURIComponent(projectMatch[1]);
    queries.push({ key: ['projects', slug, LANG], resource: { type: 'project', slug } });
    return { kind: 'page', queries, projectSlug: slug, knownRoute: true };
  }

  return { kind: 'page', queries, knownRoute: staticRoutes.has(path) };
}

export interface RenderResult {
  status: number;
  html: string;
  head: string;
  state: unknown;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Serializes JSON for an inline <script>, so CMS text can never close the tag.
function jsonForScript(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

// schema.org data for the homepage: identifies the site as the portfolio of a person who is a developer.
function buildPersonJsonLd(siteUrl: string, profile: any, contact: any, seo: any, description: string) {
  const sameAs = [contact?.github_url, contact?.linkedin_url, contact?.twitter_url, contact?.instagram_url]
    .filter((u) => typeof u === 'string' && /^https?:\/\//.test(u));
  const person: Record<string, unknown> = {
    '@type': 'Person',
    '@id': `${siteUrl}/#person`,
    name: profile?.name || undefined,
    jobTitle: typeof profile?.title === 'string' ? profile.title.split(',')[0].trim() : undefined,
    description,
    url: siteUrl,
    image: profile?.profile_image_url || undefined,
    knowsAbout: ['Web development', 'Frontend development', 'React', 'Solar energy systems'],
    sameAs: sameAs.length ? sameAs : undefined,
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      person,
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: getPageTitle(null, seo, profile),
        description,
        publisher: { '@id': `${siteUrl}/#person` },
      },
      {
        '@type': 'ProfilePage',
        '@id': `${siteUrl}/#profilepage`,
        url: siteUrl,
        mainEntity: { '@id': `${siteUrl}/#person` },
      },
    ],
  };
}

function buildHead(url: string, data: Map<string, any>, plan: RoutePlan, siteUrl: string): string {
  const seo = data.get('seo') || {};
  const profile = data.get('profile') || {};
  const contact = data.get('contact_info') || {};
  const project = plan.projectSlug ? data.get(`project:${plan.projectSlug}`) : null;
  const pathname = url.split('?')[0].split('#')[0] || '/';
  const pagePath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/';

  const routeMeta = getRouteMeta(pagePath, seo, profile);
  const title = project
    ? getPageTitle(project.seo_title || project.title, seo, profile)
    : routeMeta?.title ?? getSiteTitle(seo, profile);
  const description = project
    ? project.seo_description || project.description || getSiteDescription(seo, profile)
    : routeMeta?.description ?? getSiteDescription(seo, profile);
  const image = project?.hero_image_url || project?.thumbnail_url || seo.og_image_url || seo.twitter_card_image || profile.profile_image_url || `${siteUrl}/og-image.png`;
  const canonical = siteUrl + (pagePath === '/' ? '/' : pagePath);
  const siteName = seo.site_name || profile.name || getSiteTitle(seo, profile);

  const tags = [`<title>${escapeHtml(title)}</title>`];
  if (description) {
    tags.push(`<meta name="description" content="${escapeHtml(description)}" />`);
  }
  tags.push(`<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  tags.push(`<meta property="og:type" content="${project ? 'article' : pagePath === '/' ? 'profile' : 'website'}" />`);
  tags.push(`<meta property="og:site_name" content="${escapeHtml(siteName)}" />`);
  tags.push(`<meta property="og:title" content="${escapeHtml(title)}" />`);
  if (description) tags.push(`<meta property="og:description" content="${escapeHtml(description)}" />`);
  tags.push(`<meta property="og:url" content="${escapeHtml(canonical)}" />`);
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);
    tags.push(`<meta property="og:image:alt" content="${escapeHtml(project ? project.title : siteName)}" />`);
  }
  tags.push(`<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`);
  tags.push(`<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  if (description) tags.push(`<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  if (image) tags.push(`<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  if (seo.twitter_handle) {
    tags.push(`<meta name="twitter:site" content="${escapeHtml(seo.twitter_handle)}" />`);
  }
  if (seo.meta_keywords) {
    tags.push(`<meta name="keywords" content="${escapeHtml(seo.meta_keywords)}" />`);
  }
  tags.push(`<link rel="icon" href="${escapeHtml(seo.favicon_url || '/favicon.svg')}" />`);
  tags.push('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
  if (pagePath === '/') {
    tags.push(`<script type="application/ld+json">${jsonForScript(buildPersonJsonLd(siteUrl, profile, contact, seo, description))}</script>`);
  }
  return tags.join('\n    ');
}

// `data` maps each resolved resource ("profile", "project:<slug>", ...) to its content.
// Resources that failed to load are simply absent; the page then renders its built-in fallbacks.
// siteUrl is the site's public base URL (no trailing slash), used for canonical/og:url and structured data.
export function render(url: string, plan: RoutePlan, data: Map<string, any>, siteUrl: string): RenderResult {
  const queryClient = createQueryClient();
  for (const entry of plan.queries) {
    const id = entry.resource.type === 'project' ? `project:${entry.resource.slug}` : entry.resource.type;
    if (data.has(id)) {
      queryClient.setQueryData(entry.key, data.get(id));
    }
  }

  const html = renderToString(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StaticRouter location={url}>
            <App />
          </StaticRouter>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>
  );

  const state = dehydrate(queryClient);
  queryClient.clear();

  const missingProject =
    !!plan.projectSlug &&
    data.has(`project:${plan.projectSlug}`) &&
    data.get(`project:${plan.projectSlug}`) === null &&
    !projectsData.some((p) => p.id === plan.projectSlug);
  const status = !plan.knownRoute || missingProject ? 404 : 200;

  return { status, html, head: buildHead(url, data, plan, siteUrl), state };
}
