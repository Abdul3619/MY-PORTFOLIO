// The site's public base URL, used wherever an absolute link to this site is needed: links sent by email
// (password reset), canonical/og:url tags, the sitemap and robots.txt.
//
// Sources, in order:
//   1. SITE_URL - set this to pin a specific domain (e.g. a custom domain).
//   2. VERCEL_PROJECT_PRODUCTION_URL - provided by Vercel; it is the project's production domain and
//      switches to the custom domain automatically once one is added.
//   3. The current origin (local development, or hosts that provide neither).

// Turns "example.com", "https://example.com/" etc. into "https://example.com" (no trailing slash).
// Returns '' for empty or malformed values.
export function normalizeSiteUrl(value: string | null | undefined): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

// First usable value from SITE_URL / VERCEL_PROJECT_PRODUCTION_URL in the given environment.
export function siteUrlFromEnv(env: Record<string, string | undefined>): string {
  return normalizeSiteUrl(env.SITE_URL) || normalizeSiteUrl(env.VERCEL_PROJECT_PRODUCTION_URL);
}

// Resolved from the environment at build time by vite.config.ts ('' when neither variable is set).
declare const __SITE_URL__: string;

// Base URL for code running in the browser.
export function getClientSiteUrl(): string {
  const built = typeof __SITE_URL__ === 'string' ? __SITE_URL__ : '';
  if (built) return built;
  return typeof window !== 'undefined' ? window.location.origin : '';
}

// Absolute URL on this site that Supabase auth emails should send the user back to, e.g.
// getAuthRedirectUrl('/admin/account'). Passed explicitly as redirectTo so the link never depends on the
// "Site URL" setting in the Supabase dashboard. The URL must also be on the dashboard's Redirect URLs list.
export function getAuthRedirectUrl(path: string): string {
  return new URL(path, `${getClientSiteUrl()}/`).toString();
}
