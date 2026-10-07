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
  const lower = email.toLowerCase();
  if (
    lower.includes('example.com') ||
    lower.includes('domain.com') ||
    lower.includes('email.com') ||
    lower.includes('yoursite.com') ||
    lower.includes('sentry.io') ||
    lower.includes('wixpress.com') ||
    lower.includes('wordpress.org') ||
    lower.includes('bootstrap') ||
    lower.startsWith('test@') ||
    lower.startsWith('user@')
  ) {
    return false;
  }
  const tld = email.split('.').pop() || '';
  return KNOWN_TLDS.has(tld) || (tld.length >= 2 && tld.length <= 6 && /^[a-z]+$/.test(tld));
}

function extractPhones(html: string): string[] {
  const found = new Set<string>();
  const telRe = /tel:([+\d][\d\s().-]{5,20})/gi;
  for (const m of html.matchAll(telRe)) {
    found.add(m[1].trim());
  }
  // WhatsApp links often carry the real phone number on local business sites:
  const waRe = /(?:wa\.me\/|api\.whatsapp\.com\/send\?(?:[^"' >]*&)?phone=)(\+?\d{8,16})/gi;
  for (const m of html.matchAll(waRe)) {
    found.add(m[1].trim());
  }
  if (found.size === 0) {
    const text = blockSeparatedText(html);
    // Support Nigerian mobile formats (080..., 070..., 090..., +234...) and international formats:
    const phoneRe = /(?:\+?234|0)[789][01]\d{8}|\+?\d{1,4}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
    for (const m of text.match(phoneRe) || []) {
      found.add(m.trim());
      if (found.size >= 5) break;
    }
  }
  return Array.from(found);
}

// A raw href from a site's HTML can be protocol-relative ("//facebook.com/..."), missing a protocol
// entirely ("facebook.com/..."), or a "Share this page" / login / intent link that happens to contain the
// platform's domain without actually being the business's own profile. Clicking any of those either does
// nothing (an unresolvable relative URL) or lands somewhere useless -- both read as "the button is broken"
// even though a link is technically present. This turns a raw href into either a real, absolute URL worth
// offering as a contact method, or null when it's not actually one.
function normalizeSocialHref(raw: string, platform: string): string | null {
  let href = raw.trim();
  if (!href) return null;
  if (href.startsWith('//')) href = `https:${href}`;
  else if (!/^https?:\/\//i.test(href)) href = `https://${href.replace(/^\/+/, '')}`;

  const NOISE = /\/(sharer|share\.php|intent|dialog\/share|login|accounts\/login|developers?|business|policy|about|privacy|help)(\/|$|\?)/i;
  if (NOISE.test(href)) return null;

  try {
    const u = new URL(href);
    const path = u.pathname.replace(/\/+$/, '');
    // A link to the bare domain root (no page/handle in the path) isn't a usable contact method -- it's
    // generally a "Follow us" icon nobody customized, not this business's actual profile.
    if (!path || path === '/') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function extractSocialLinks(html: string): Record<string, string> {
  const links: Record<string, string> = {};
  const hrefRe = /href=["']([^"']+)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const href = m[1];
    let platform: string | null = null;
    if (href.includes('linkedin.com')) platform = 'linkedin';
    else if (href.includes('facebook.com')) platform = 'facebook';
    else if (href.includes('instagram.com')) platform = 'instagram';
    else if (href.includes('twitter.com') || href.includes('x.com')) platform = 'x';
    else if (href.includes('youtube.com') || href.includes('youtu.be')) platform = 'youtube';
    else if (href.includes('wa.me/') || href.includes('whatsapp.com')) platform = 'whatsapp';
    if (!platform || links[platform]) continue;
    const normalized = normalizeSocialHref(href, platform);
    if (normalized) links[platform] = normalized;
  }
  // Also detect raw Instagram links if not enclosed in standard href:
  if (!links.instagram) {
    const igMatch = html.match(/(?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/|instagr\.am\/)([\w.-]+)/i);
    if (igMatch && !['p', 'reel', 'tv', 'explore', 'about', 'developer'].includes(igMatch[1].toLowerCase())) {
      links.instagram = `https://instagram.com/${igMatch[1]}`;
    }
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

// Markup that strongly suggests a site hasn't been rebuilt since the early-2000s/2010s era -- these tags and
// attributes have been obsolete for over a decade, so their presence (not just old-looking colors, which we
// can't judge from HTML alone) is a genuinely reliable "this is old" signal rather than a guess.
function detectOutdatedMarkup(html: string): boolean {
  const lower = html.toLowerCase();
  if (/<center\b|<font\b|<marquee\b|<blink\b/.test(lower)) return true;
  if (/bgcolor\s*=|background\s*=\s*["'][^"']*\.(gif|jpg)/.test(lower)) return true;
  // Heavy table-based layout scaffolding (as opposed to a single data table): many nested/adjacent <table>
  // tags used purely for structure is a classic pre-CSS-layout pattern.
  const tableCount = (lower.match(/<table\b/g) || []).length;
  if (tableCount >= 4) return true;
  return false;
}

// A "© 2014 Acme Plumbing" style footer notice that's several years stale is one of the few honest, visible
// "this hasn't been updated" signals a business owner would recognize immediately if pointed out.
function detectOldCopyrightYear(html: string): number | null {
  const text = blockSeparatedText(html);
  const re = /(?:copyright|©|\(c\))\s*[:\-]?\s*(19|20)(\d{2})/i;
  const m = text.match(re);
  if (!m) return null;
  const year = parseInt(m[1] + m[2], 10);
  const currentYear = new Date().getFullYear();
  if (year < 1998 || year > currentYear) return null; // implausible, likely a false match
  return year;
}

const CTA_VERBS = /\b(book|call|order|contact|shop|buy|schedule|reserve|request|get a quote|get started|sign up|subscribe|checkout|apply|donate|email us|message us|chat with us)\b/i;

function detectCallToAction(html: string): boolean {
  const linkTextRe = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  const buttonTextRe = /<button\b[^>]*>([\s\S]*?)<\/button>/gi;
  for (const re of [linkTextRe, buttonTextRe]) {
    for (const m of html.matchAll(re)) {
      const text = decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      if (text && CTA_VERBS.test(text)) return true;
    }
  }
  return false;
}

function detectOnlinePayment(html: string): boolean {
  const lower = html.toLowerCase();
  return /add[-\s]?to[-\s]?cart|checkout|buy now|book now|book online|paystack|stripe\.com|\bpaypal\b|flutterwave|razorpay|square\s*up|woocommerce/.test(lower);
}

// Generic, reusable "does the page mention X at all" detectors. These are deliberately coarse (a keyword
// hit, not a verified feature) -- they exist so business-type-specific requirements (see
// businessRequirements.ts) can ask "does a restaurant site at least mention a menu" without each category
// needing its own bespoke extraction logic.
function detectKeywordPresence(bodyText: string, pattern: RegExp): boolean {
  return pattern.test(bodyText);
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

  const usesOutdatedMarkup = detectOutdatedMarkup(html);
  const oldCopyrightYear = detectOldCopyrightYear(html);
  const hasClearCallToAction = detectCallToAction(html);
  const hasOnlinePayment = detectOnlinePayment(html);

  const hasPricingInfo = detectKeywordPresence(bodyText, /\b(price|pricing|rates?|from\s*[₦$£€]|\b[₦$£€]\s*\d)/i);
  const hasHoursInfo = detectKeywordPresence(bodyText, /\b(monday|mon)\b.{0,20}\b(friday|fri)\b|\bopening hours\b|\bhours of operation\b|\bopen\s*(daily|24)/i)
    || detectKeywordPresence(bodyText, /\b\d{1,2}(:\d{2})?\s*(am|pm)\s*[-–]\s*\d{1,2}(:\d{2})?\s*(am|pm)\b/i);
  const hasAddressInfo = detectKeywordPresence(bodyText, /\b\d+\s+[a-z0-9.'\s]{2,40}\b(street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|close|crescent|boulevard|way)\b/i)
    || /google\.com\/maps|maps\.google|openstreetmap\.org/i.test(html);
  const hasMenuMention = detectKeywordPresence(bodyText, /\bmenu\b/i);
  const hasBookingMention = detectKeywordPresence(bodyText, /\b(book now|booking|reserve|reservation|appointment|schedule a|book an? appointment)\b/i);
  const hasPortfolioMention = detectKeywordPresence(bodyText, /\b(portfolio|gallery|our work|past work|previous work|case studies)\b/i);
  // Customer testimonials/reviews are called out as one of the standard "every small business site needs
  // this" items (https://fireart.studio/brief-checklist-10-key-things-every-small-business-website-needs/)
  // -- it's the one social-proof signal that applies across nearly every category, not just a few.
  const hasTestimonials = detectKeywordPresence(bodyText, /\b(testimonial|customer review|client review|what (our )?(clients?|customers?) say|\d(\.\d)?\s*(out of|\/)\s*5\b|★{3,}|★{3,})/i);

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
  if (usesOutdatedMarkup) issues.push('Page uses obsolete HTML techniques (table-based layout, <font>/<center> tags) typical of a site built well over a decade ago');
  if (oldCopyrightYear !== null && oldCopyrightYear <= new Date().getFullYear() - 3) {
    issues.push(`Footer copyright notice still says ${oldCopyrightYear}, suggesting the site hasn't been touched since then`);
  }
  if (!hasClearCallToAction) issues.push('No button or link anywhere on the page tells a visitor what to do next (book, call, order, contact)');
  if (!hasOnlinePayment) issues.push('No online payment, booking, or checkout flow detected on the site');
  if (!hasTestimonials) issues.push('No customer testimonials or reviews shown on the site');

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
    usesOutdatedMarkup,
    oldCopyrightYear,
    hasClearCallToAction,
    hasOnlinePayment,
    hasPricingInfo,
    hasHoursInfo,
    hasAddressInfo,
    hasMenuMention,
    hasBookingMention,
    hasPortfolioMention,
    hasTestimonials,
  };
}

export const _internal = { extractEmails, trimToPlausibleTld, isPlausibleEmail };
