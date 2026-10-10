// Shared between the client (document.title) and the server renderer (<title> in the initial HTML)
export function getSiteTitle(seo: any, profile: any): string {
  if (seo?.site_title) return seo.site_title;
  if (seo?.browser_title) return seo.browser_title;
  if (profile?.name) {
    const primaryRole = typeof profile.title === 'string' ? profile.title.split(',')[0].trim() : '';
    return primaryRole ? `${profile.name} | ${primaryRole}` : profile.name;
  }
  return 'My Portfolio';
}

export function getPageTitle(pageTitle: string | null | undefined, seo: any, profile: any): string {
  const siteTitle = getSiteTitle(seo, profile);
  return pageTitle ? `${pageTitle} | ${siteTitle}` : siteTitle;
}

// Per-page title and description for the static routes. Used by the server renderer (<title>, meta and
// Open Graph tags in the initial HTML) and by the client when navigating, so both always agree.
// Project pages use the project's own title/description instead.
const PAGE_META: Record<string, { title: string; description: (who: string) => string }> = {
  '/about': { title: 'About', description: (who) => `About ${who}: background and how I work as a web developer.` },
  '/skills': { title: 'Skills', description: (who) => `Technical skills of ${who}: frontend and web development skills and tools.` },
  '/projects': { title: 'Projects', description: (who) => `Selected projects by ${who}: websites and web apps built for real businesses, with live demos.` },
  '/certificates': { title: 'Certificates', description: (who) => `Certificates and credentials earned by ${who}.` },
  '/testimonials': { title: 'Testimonials', description: (who) => `What clients say about working with ${who}, and a form to leave your own review.` },
  '/resume': { title: 'Resume', description: (who) => `Resume of ${who}: experience, education and skills.` },
  '/contact': { title: 'Contact', description: (who) => `Get in touch with ${who} about a website or web app.` },
};

export const STATIC_ROUTES = ['/', ...Object.keys(PAGE_META)];

const normalizePath = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname);

function plainText(value: unknown): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  // Never use serialized settings (JSON) as page text
  return text.startsWith('{') || text.startsWith('[') ? '' : text;
}

// Keeps descriptions within the ~160 characters search engines show.
function clip(text: string, max = 160): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : cut.length)}…`;
}

export function getSiteDescription(seo: any, profile: any): string {
  const custom = plainText(seo?.meta_description) || plainText(profile?.bio);
  if (custom) return clip(custom);
  const who = plainText(profile?.name) || 'this developer';
  const role = plainText(profile?.title);
  return clip(`${role ? `${who}, ${role}.` : `${who}.`} Portfolio of websites and web apps built for real businesses.`);
}

// Title and description for a static route (null for routes without their own meta, such as project pages).
export function getRouteMeta(pathname: string, seo: any, profile: any): { title: string; description: string } | null {
  const path = normalizePath(pathname);
  if (path === '/') return { title: getSiteTitle(seo, profile), description: getSiteDescription(seo, profile) };
  const meta = PAGE_META[path];
  if (!meta) return null;
  const who = plainText(profile?.name) || 'me';
  return { title: getPageTitle(meta.title, seo, profile), description: clip(meta.description(who)) };
}
