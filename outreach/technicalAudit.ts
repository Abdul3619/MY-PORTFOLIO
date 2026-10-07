// Real functional problems, not pattern-matched guesses: does every button on the page actually go
// somewhere, do the links that exist actually resolve, do the images actually load. These are the concrete,
// pointable-to issues a human clicking through the site would notice in the first thirty seconds --
// "this button doesn't do anything" -- as opposed to the more abstract technical-SEO-style signals
// (missing alt text, old copyright year) that htmlExtract.ts already checks.
//
// Deliberately bounded: a handful of same-domain links/images, short timeouts, run in parallel -- this adds
// a few seconds to a crawl, not tens of seconds, and never blocks the rest of the pipeline if it fails.

import type { UrlSafetyResult } from './security.js';

const LINK_CHECK_TIMEOUT_MS = 4000;
const MAX_LINKS_CHECKED = 5;
const MAX_IMAGES_CHECKED = 4;

async function timedStatusCheck(url: string, timeoutMs: number): Promise<{ ok: boolean; status: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'AIOutreachBot/1.0 (link check; see README)' },
    });
    // Some servers don't implement HEAD properly and answer with 405/501 even though the page is fine --
    // fall back to a real GET before concluding anything is actually broken.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'AIOutreachBot/1.0 (link check; see README)' },
      });
    }
    return { ok: res.ok, status: res.status };
  } catch {
    return null; // timeout or network error -- reported separately from a confirmed broken (4xx/5xx) link
  } finally {
    clearTimeout(timer);
  }
}

export interface TechnicalAuditResult {
  issues: string[];
  deadButtonCount: number;
  brokenLinkCount: number;
  brokenImageCount: number;
}

const EMPTY_RESULT: TechnicalAuditResult = { issues: [], deadButtonCount: 0, brokenLinkCount: 0, brokenImageCount: 0 };

/** Audits the actual working-ness of a crawled page: buttons that go nowhere (href="#" with no real
 * destination), internal links that 404 or time out, and images that fail to load. Only ever checks links
 * on the SAME domain as the page itself -- a broken link to someone else's site isn't this business's
 * problem to fix, and isn't worth flagging to them as one. Returns both the human-readable issue lines (for
 * the review-queue UI) and plain counts (so the draft prompt can speak to them in its own words). */
export async function auditTechnicalIssues(
  html: string,
  pageUrl: string,
  checkUrlIsSafeToFetch: (url: string) => Promise<UrlSafetyResult>,
): Promise<TechnicalAuditResult> {
  const issues: string[] = [];
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return EMPTY_RESULT;
  }

  // ---- Buttons/links that go nowhere, or that point somewhere real -------
  const anchorRe = /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const deadPlaceholders = new Set<string>();
  const candidates: { href: string; text: string }[] = [];
  for (const m of html.matchAll(anchorRe)) {
    const href = m[1].trim();
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 2) continue; // icon-only/decorative link, not something a visitor reads as "a button"
    if (!href || href === '#' || /^javascript:\s*(void\(0\)|;)?\s*$/i.test(href)) {
      deadPlaceholders.add(text.slice(0, 40));
      continue;
    }
    let resolved: URL;
    try {
      resolved = new URL(href, base);
    } catch {
      continue;
    }
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
    if (resolved.hostname !== base.hostname) continue;
    if (resolved.hash && resolved.pathname === base.pathname && resolved.search === base.search) continue; // same-page anchor
    candidates.push({ href: resolved.toString(), text: text.slice(0, 40) });
  }

  if (deadPlaceholders.size > 0) {
    const sample = Array.from(deadPlaceholders).slice(0, 3).join('", "');
    issues.push(
      `${deadPlaceholders.size} button${deadPlaceholders.size === 1 ? '' : 's'} on the page go nowhere when clicked (e.g. "${sample}") -- no real link or action behind them`,
    );
  }

  const seen = new Set<string>();
  const toCheck = candidates
    .filter((c) => {
      if (seen.has(c.href)) return false;
      seen.add(c.href);
      return true;
    })
    .slice(0, MAX_LINKS_CHECKED);

  const broken: string[] = [];
  let unreachableCount = 0;
  await Promise.all(
    toCheck.map(async (c) => {
      const safety = await checkUrlIsSafeToFetch(c.href);
      if (!safety.safe) return; // not every refusal here means the link itself is broken -- skip, don't flag
      const result = await timedStatusCheck(c.href, LINK_CHECK_TIMEOUT_MS);
      if (!result) unreachableCount++;
      else if (result.status >= 400) broken.push(`"${c.text}" (HTTP ${result.status})`);
    }),
  );

  if (broken.length > 0) {
    issues.push(`${broken.length} link${broken.length === 1 ? '' : 's'} on the page are actually broken: ${broken.slice(0, 3).join(', ')}`);
  }
  if (unreachableCount >= 2) {
    issues.push(`${unreachableCount} links on the page timed out or couldn't be reached -- may be broken or just slow`);
  }

  // ---- Images that fail to load ------------------------------------------
  const imgRe = /<img\b[^>]*>/gi;
  const imgCandidates: string[] = [];
  for (const m of html.matchAll(imgRe)) {
    const srcMatch = m[0].match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const src = srcMatch[1].trim();
    if (!src || src.startsWith('data:')) continue;
    let resolved: URL;
    try {
      resolved = new URL(src, base);
    } catch {
      continue;
    }
    if (resolved.hostname !== base.hostname) continue; // third-party image hosts/CDNs aren't this site's fault to fix
    imgCandidates.push(resolved.toString());
  }
  const imgSeen = new Set<string>();
  const imgsToCheck = imgCandidates
    .filter((u) => {
      if (imgSeen.has(u)) return false;
      imgSeen.add(u);
      return true;
    })
    .slice(0, MAX_IMAGES_CHECKED);

  let brokenImages = 0;
  await Promise.all(
    imgsToCheck.map(async (u) => {
      const safety = await checkUrlIsSafeToFetch(u);
      if (!safety.safe) return;
      const result = await timedStatusCheck(u, LINK_CHECK_TIMEOUT_MS);
      if (result && result.status >= 400) brokenImages++;
    }),
  );
  if (brokenImages > 0) {
    issues.push(`${brokenImages} image${brokenImages === 1 ? '' : 's'} on the page fail to load (broken image link)`);
  }

  return { issues, deadButtonCount: deadPlaceholders.size, brokenLinkCount: broken.length, brokenImageCount: brokenImages };
}
