// Fetches a business's homepage and extracts audit signals from it.
// Respects robots.txt, times out at 12s, and refuses to fetch anything that
// resolves to a private/internal address (see security.ts) — this matters
// because auto-search feeds this arbitrary URLs with no human in the loop
// beforehand.

import { checkUrlIsSafeToFetch, type UrlSafetyResult } from './security.js';
import { parseRobotsTxt, isAllowed } from './robots.js';
import { extractSignals } from './htmlExtract.js';
import { normalizeUrl } from './domain.js';
import type { CrawlResult } from './types.js';

const USER_AGENT = 'AIOutreachBot/1.0 (+local single-user tool; see README)';
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

export interface CrawlerDeps {
  /** Overridable only so tests can point the crawler at a local fixture
   * server (which necessarily lives on a loopback address that the real
   * SSRF guard would — correctly — refuse in production). Production code
   * always uses the real checkUrlIsSafeToFetch. */
  checkUrlIsSafeToFetch: (url: string) => Promise<UrlSafetyResult>;
}

const defaultDeps: CrawlerDeps = { checkUrlIsSafeToFetch };

async function timedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'manual' });
  } finally {
    clearTimeout(timer);
  }
}

/** Fetches a URL, manually following redirects one hop at a time so every
 * hop can be re-checked against the SSRF guard (a malicious/misconfigured
 * server could otherwise redirect a "safe" public URL to an internal one). */
async function safeFetchFollowingRedirects(startUrl: string, deps: CrawlerDeps): Promise<Response> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const safety = await deps.checkUrlIsSafeToFetch(url);
    if (!safety.safe) {
      throw new Error(`Refused to fetch (SSRF guard): ${safety.reason}`);
    }
    const res = await timedFetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res;
      url = new URL(location, url).toString();
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
}

async function fetchRobotsRules(pageUrl: string, deps: CrawlerDeps) {
  const url = new URL(pageUrl);
  const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
  const safety = await deps.checkUrlIsSafeToFetch(robotsUrl);
  if (!safety.safe) {
    // If we can't even safely check robots.txt, don't crawl.
    throw new Error(`Refused to fetch robots.txt (SSRF guard): ${safety.reason}`);
  }
  try {
    const res = await timedFetch(robotsUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return { disallow: [], allow: [], crawlDelaySeconds: null };
    const text = await res.text();
    return parseRobotsTxt(text, USER_AGENT);
  } catch {
    // Unreachable/malformed robots.txt: default to allowed, as most crawlers do.
    return { disallow: [], allow: [], crawlDelaySeconds: null };
  }
}

export async function crawlHomepage(targetUrl: string, deps: CrawlerDeps = defaultDeps): Promise<CrawlResult> {
  let url: string;
  try {
    url = normalizeUrl(targetUrl);
  } catch (e: any) {
    return { ok: false, error: e.message || 'Invalid URL' };
  }

  try {
    const robots = await fetchRobotsRules(url, deps);
    const path = new URL(url).pathname || '/';
    if (!isAllowed(robots, path)) {
      return { ok: false, error: `Crawling disallowed by robots.txt for ${path}` };
    }
    if (robots.crawlDelaySeconds && robots.crawlDelaySeconds > 0) {
      await new Promise((r) => setTimeout(r, Math.min(robots.crawlDelaySeconds! * 1000, 5000)));
    }

    const res = await safeFetchFollowingRedirects(url, deps);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('html')) {
      return { ok: false, error: `Expected HTML, got content-type "${contentType}"` };
    }

    const html = await res.text();
    const finalUrl = res.url || url;
    const evidence = extractSignals(html, finalUrl);
    return { ok: true, evidence };
  } catch (e: any) {
    return { ok: false, error: e.message || 'Unknown crawl error' };
  }
}
