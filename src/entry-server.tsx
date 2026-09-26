import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { QueryClientProvider, dehydrate, type QueryKey } from '@tanstack/react-query';
import './lib/i18n';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { createQueryClient } from './lib/queryClient';
import { getPageTitle } from './lib/seo';
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

function buildHead(url: string, data: Map<string, any>, plan: RoutePlan): string {
  const seo = data.get('seo') || {};
  const profile = data.get('profile') || {};
  const project = plan.projectSlug ? data.get(`project:${plan.projectSlug}`) : null;

  const title = getPageTitle(project?.seo_title || project?.title, seo, profile);
  const description = project?.seo_description || project?.description || seo.meta_description || profile.bio || '';
  const image = project?.hero_image_url || project?.thumbnail_url || seo.og_image_url || seo.twitter_card_image || profile.profile_image_url || '';

  const tags = [`<title>${escapeHtml(title)}</title>`];
  if (description) {
    tags.push(`<meta name="description" content="${escapeHtml(description)}" />`);
    tags.push(`<meta property="og:description" content="${escapeHtml(description)}" />`);
  }
  tags.push(`<meta property="og:title" content="${escapeHtml(title)}" />`);
  tags.push(`<meta property="og:type" content="${project ? 'article' : 'website'}" />`);
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);
  }
  tags.push(`<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`);
  if (seo.twitter_handle) {
    tags.push(`<meta name="twitter:site" content="${escapeHtml(seo.twitter_handle)}" />`);
  }
  if (seo.meta_keywords) {
    tags.push(`<meta name="keywords" content="${escapeHtml(seo.meta_keywords)}" />`);
  }
  if (seo.canonical_url) {
    const base = String(seo.canonical_url).replace(/\/+$/, '');
    tags.push(`<link rel="canonical" href="${escapeHtml(base + (url.split('?')[0] === '/' ? '' : url.split('?')[0]))}" />`);
  }
  tags.push(`<link rel="icon" href="${escapeHtml(seo.favicon_url || 'data:,')}" />`);
  return tags.join('\n    ');
}

// `data` maps each resolved resource ("profile", "project:<slug>", ...) to its content.
// Resources that failed to load are simply absent; the page then renders its built-in fallbacks.
export function render(url: string, plan: RoutePlan, data: Map<string, any>): RenderResult {
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

  return { status, html, head: buildHead(url, data, plan), state };
}
