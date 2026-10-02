// Pulls the handful of signals we actually need out of a page's raw HTML.
// Deliberately regex/string-based instead of a full DOM parser (cheerio) —
// the signal set is small and fixed, this has zero dependencies, and it's
// easy to unit-test without any install step.
//
// This is where the original repo's crawler had two real bugs, both fixed
// here:
//  1. Email addresses got the next word glued on (e.g.
//     "joe@joesplumbing-test.comcopyright") because text was concatenated
//     across block-element boundaries with no separating whitespace before
//     the email regex ran. Fixed by inserting a separator at every block/line
//     boundary before extracting text, AND validating the TLD against a
//     known list so an implausible tail like "comcopyright" is rejected
//     even if it slips through.
//  2. There was no "personalized email that's actually generic" problem in
//     the crawler itself, but a bad Gemini call used to silently fall back
//     to fake data. That fallback does not exist in this rebuild — see
//     gemini.ts.

import type { CrawlEvidence } from './types.js';

const KNOWN_TLDS = new Set([
  'com', 'net', 'org', 'io', 'co', 'biz', 'info', 'us', 'uk', 'ca', 'ng',
  'gh', 'za', 'ke', 'tg', 'fr', 'de', 'es', 'it', 'nl', 'au', 'nz', 'in',
  'me', 'app', 'dev', 'shop', 'store', 'online', 'agency', 'design',
  'studio', 'company', 'email',
]);

function blockSeparatedText(html: string): string {
  // Insert a newline before/after common block-level tags and <br> so that
  // text nodes that were adjacent in the markup (but visually separated)
  // don't get concatenated into one run of characters.
  const withBreaks = html.replace(
    /<\/(p|div|li|tr|h1|h2|h3|h4|h5|h6|br|footer|header|section|article|ul|ol|table)\b[^>]*>/gi,
    '\n',
  );
  const noTags = withBreaks.replace(/<[^>]+>/g, ' ');
  return decodeEntities(noTags);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractEmails(html: string): string[] {
  const found = new Set<string>();

  // 1. mailto: links first — most reliable source, href attribute value is
  //    a discrete string so it can't be glued to surrounding page text.
  const mailtoRe = /mailto:([^"'?\s>]+)/gi;
  for (const m of html.matchAll(mailtoRe)) {
    const candidate = m[1].trim().toLowerCase();
    if (isPlausibleEmail(candidate)) found.add(candidate);
  }

  // 2. Fallback: scan the block-separated visible text for bare emails.
  if (found.size === 0) {
    const text = blockSeparatedText(html);
    const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}/g;
    for (const m of text.matchAll(emailRe)) {
      const candidate = trimToPlausibleTld(m[0].toLowerCase());
      if (candidate && isPlausibleEmail(candidate)) found.add(candidate);
    }
  }

  return Array.from(found);
}

/** If the matched "TLD" is actually a known TLD followed by glued-on extra
 * letters (e.g. "comcopyright"), trims back to the known TLD. Returns null
 * if no known TLD can be found in the tail. */
function trimToPlausibleTld(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at === -1) return null;
  const domainPart = email.slice(at + 1);
  const dotIdx = domainPart.lastIndexOf('.');
  if (dotIdx === -1) return null;
  const tail = domainPart.slice(dotIdx + 1);

  if (KNOWN_TLDS.has(tail)) return email;

  // Try progressively shorter prefixes of the tail against the known list
  // (handles "comcopyright" -> "com", "orgprivacy" -> "org").
  for (let len = Math.min(tail.length - 1, 10); len >= 2; len--) {
    const prefix = tail.slice(0, len);
    if (KNOWN_TLDS.has(prefix)) {
      return `${email.slice(0, at)}@${domainPart.slice(0, dotIdx + 1)}${prefix}`;
    }
  }
  return null;
}

function isPlausibleEmail(email: string): boolean {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  if (email.length > 254) return false;
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(email)) return false;
  const tld = email.split('.').pop() || '';
  return KNOWN_TLDS.has(tld) || (tld.length >= 2 && tld.length <= 6 && /^[a-z]+$/.test(tld));
}

function extractPhones(html: string): string[] {
  const found = new Set<string>();
  const telRe = /tel:([+\d][\d\s().-]{5,20})/gi;
  for (const m of html.matchAll(telRe)) {
    found.add(m[1].trim());
  }
  if (found.size === 0) {
    const text = blockSeparatedText(html);
    const phoneRe = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    for (const m of text.match(phoneRe) || []) {
      found.add(m.trim());
      if (found.size >= 5) break;
    }
  }
  return Array.from(found);
}

function extractSocialLinks(html: string): Record<string, string> {
  const links: Record<string, string> = {};
  const hrefRe = /href=["']([^"']+)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const href = m[1];
    if (href.includes('linkedin.com')) links.linkedin = href;
    else if (href.includes('facebook.com')) links.facebook = href;
    else if (href.includes('instagram.com')) links.instagram = href;
    else if (href.includes('twitter.com') || href.includes('x.com')) links.x = href;
    else if (href.includes('youtube.com') || href.includes('youtu.be')) links.youtube = href;
  }
  return links;
}

function detectCms(html: string): string | null {
  const lower = html.toLowerCase();
  const table: [string, RegExp][] = [
    ['WordPress', /wp-content|wp-includes|wp-json/],
    ['Shopify', /cdn\.shopify\.com|shopify\.theme/],
    ['Webflow', /data-wf-page|webflow\.com/],
    ['Squarespace', /squarespace\.com|squarespace-cdn/],
    ['Wix', /wix\.com|wix-code|_wixCssTransforms/],
    ['HubSpot', /hs-scripts\.com|hubspot\.com/],
  ];
  for (const [name, re] of table) {
    if (re.test(lower)) return name;
  }
  return null;
}

function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  for (const m of html.matchAll(re)) {
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (text) headings.push(text);
  }
  return headings.slice(0, 20);
}

export function extractSignals(html: string, finalUrl: string): CrawlEvidence {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : '';

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const metaDescription = descMatch ? decodeEntities(descMatch[1]).trim() : '';

  const hasViewportMeta = /<meta[^>]+name=["']viewport["']/i.test(html);

  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const imagesMissingAlt = imgTags.filter((tag) => !/\balt=["'][^"']*["']/i.test(tag) || /\balt=["']\s*["']/i.test(tag)).length;

  const cms = detectCms(html);
  const emails = extractEmails(html);
  const phones = extractPhones(html);
  const socialLinks = extractSocialLinks(html);
  const headings = extractHeadings(html);

  const bodyText = blockSeparatedText(html);
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  const usesHttps = finalUrl.startsWith('https://');

  const issues: string[] = [];
  if (!title) issues.push('Missing <title> tag');
  if (!metaDescription) issues.push('Missing meta description');
  else if (metaDescription.length < 50) issues.push('Meta description is very short (under 50 characters)');
  if (!hasViewportMeta) issues.push('Missing mobile viewport meta tag — the site likely does not render correctly on phones');
  if (imgTags.length > 0 && imagesMissingAlt > 0) {
    issues.push(`${imagesMissingAlt} of ${imgTags.length} images are missing alt text`);
  }
  if (headings.filter((h) => true).length === 0) issues.push('No H1/H2/H3 headings found on the page');
  if (!usesHttps) issues.push('Site is served over HTTP, not HTTPS');
  if (emails.length === 0 && phones.length === 0) issues.push('No email address or phone number found on the homepage');
  if (Object.keys(socialLinks).length === 0) issues.push('No social media links found');
  if (wordCount < 150) issues.push(`Very little text content on the homepage (${wordCount} words)`);

  return {
    finalUrl,
    title,
    metaDescription,
    hasViewportMeta,
    headings,
    imageCount: imgTags.length,
    imagesMissingAlt,
    cms,
    emails,
    phones,
    socialLinks,
    issues,
    wordCount,
    usesHttps,
    rawBytes: Buffer.byteLength(html, 'utf8'),
  };
}

export const _internal = { extractEmails, trimToPlausibleTld, isPlausibleEmail };
