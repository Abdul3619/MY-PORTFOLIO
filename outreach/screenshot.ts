// Captures a real screenshot of a crawled business's homepage, for the visual/design audit (visualAudit.ts)
// to actually look at -- not guess at from HTML. Runs headless Chromium inside this same Vercel serverless
// function via puppeteer-core + @sparticuz/chromium-min, following the confirmed working pattern from the
// official "Puppeteer on Vercel" template (github.com/gabenunez/puppeteer-on-vercel): the real Chromium
// binary is packaged into public/chromium-pack.tar at install time (see scripts/postinstall-chromium.mjs)
// and served from this same deployed site, so chromium-min downloads and extracts it from our own domain at
// runtime instead of depending on an external URL that could go stale.
//
// This is the one piece of the outreach pipeline with real infrastructure risk (a native binary, a real
// browser, real navigation). It now runs automatically for every website lead as part of the main pipeline
// (pipeline.ts) -- nobody has to click anything for it to happen -- but stays best-effort and serialized
// (see withGlobalBrowserLock below) so it can never stack up multiple browsers or take a whole lead down:
// every failure mode (missing pack, launch failure, navigation timeout, SSRF guard refusal) resolves to
// { ok: false, error } rather than throwing or hanging the request. route.ts's /leads/:id/visual-audit still
// exists as an optional manual re-run (e.g. if the automatic pass failed or the site has since changed).

import { checkUrlIsSafeToFetch } from './security.js';

const SCREENSHOT_TIMEOUT_MS = 25_000;
const VIEWPORT = { width: 1280, height: 900 };

export interface ScreenshotResult {
  ok: boolean;
  error?: string;
  /** Base64-encoded PNG, no data: URI prefix. */
  base64Png?: string;
}

function chromiumPackUrl(): string {
  const siteUrl =
    (process.env.SITE_URL && process.env.SITE_URL.trim()) ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    '';
  if (!siteUrl) throw new Error('Cannot resolve this site\'s own URL (SITE_URL / VERCEL_PROJECT_PRODUCTION_URL both unset) to fetch the Chromium pack from.');
  return `${siteUrl.replace(/\/+$/, '')}/chromium-pack.tar`;
}

let cachedExecutablePath: string | null = null;
let pendingResolve: Promise<string> | null = null;

/** Resolves (and caches, for the lifetime of this warm function instance) the path to the extracted
 * Chromium binary, downloading and unpacking it from our own site on first use. */
async function getChromiumExecutablePath(): Promise<string> {
  if (cachedExecutablePath) return cachedExecutablePath;
  if (!pendingResolve) {
    pendingResolve = (async () => {
      const chromium = (await import('@sparticuz/chromium-min')).default;
      const path = await chromium.executablePath(chromiumPackUrl());
      cachedExecutablePath = path;
      return path;
    })().catch((e) => {
      pendingResolve = null; // allow a retry on the next call rather than caching a permanent failure
      throw e;
    });
  }
  return pendingResolve;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

// The visual audit now runs automatically inside the main lead pipeline (pipeline.ts), which processes up to
// 5 leads concurrently (see runWithConcurrency). Launching a real Chromium instance per lead with no limit
// would mean up to 5 browsers running at once inside the same serverless function -- real risk of blowing the
// 2GB memory budget. This simple chain-based lock serializes every browser launch to exactly one at a time,
// globally, for the life of this warm function instance, regardless of how many callers invoke it concurrently.
let browserLock: Promise<any> = Promise.resolve();
function withGlobalBrowserLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = browserLock.then(fn, fn); // run fn next in line, whether the previous caller succeeded or failed
  browserLock = run.then(
    () => undefined,
    () => undefined, // never let one caller's failure wedge the lock for everyone after it
  );
  return run;
}

/** Takes a real screenshot of a URL's rendered homepage. Reuses the same SSRF guard the HTML crawler uses,
 * since this is another path that fetches an arbitrary, user/search-supplied URL from the server. Serialized
 * globally (see withGlobalBrowserLock) so concurrent callers queue rather than launching Chromium in parallel. */
export async function captureScreenshot(targetUrl: string): Promise<ScreenshotResult> {
  const safety = await checkUrlIsSafeToFetch(targetUrl);
  if (!safety.safe) return { ok: false, error: `Refused to fetch (SSRF guard): ${safety.reason}` };

  return withGlobalBrowserLock(() => captureScreenshotUnlocked(targetUrl));
}

async function captureScreenshotUnlocked(targetUrl: string): Promise<ScreenshotResult> {
  let browser: any;
  try {
    const result = await withTimeout(
      (async () => {
        const [{ default: chromium }, puppeteer] = await Promise.all([import('@sparticuz/chromium-min'), import('puppeteer-core')]);
        const executablePath = await getChromiumExecutablePath();
        browser = await puppeteer.launch({ headless: true, args: chromium.args, executablePath, defaultViewport: VIEWPORT });
        const page = await browser.newPage();
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: SCREENSHOT_TIMEOUT_MS });
        const screenshot = await page.screenshot({ type: 'png' });
        return Buffer.isBuffer(screenshot) ? screenshot.toString('base64') : Buffer.from(screenshot).toString('base64');
      })(),
      SCREENSHOT_TIMEOUT_MS,
      'Screenshot capture',
    );
    return { ok: true, base64Png: result };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // best-effort cleanup
      }
    }
  }
}
