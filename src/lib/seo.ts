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
