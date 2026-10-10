import { chromium, webkit, devices } from 'playwright';
import fs from 'fs';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
const BASE = 'https://abdulwahab-portfolio-tau.vercel.app';
const OUT = process.env.OUT || 'results-afpwa';
fs.mkdirSync(OUT, { recursive: true });
const report = { when: new Date().toISOString() };
const log = (k, v) => { report[k] = v; console.log(k, JSON.stringify(v)); };

// 1. Decode the real QR code StitchBook shows
let target = BASE + '/atelierfit';
try {
  const r = await fetch(BASE + '/api/atelierfit/qr-code.png');
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(`${OUT}/qr-code.png`, buf);
  const png = PNG.sync.read(buf);
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  log('qr', { status: r.status, decoded: code?.data || null });
  if (code?.data) target = code.data;
} catch (e) { log('qr', { error: String(e) }); }

// 2. Raw server response for the encoded URL
try {
  const r = await fetch(target, { redirect: 'follow' });
  const html = await r.text();
  log('raw', { status: r.status, finalUrl: r.url, headManifest: /rel="manifest"/.test(html), headTitle: (html.match(/<title>(.*?)<\/title>/) || [])[1], appleCapable: /apple-mobile-web-app-capable/.test(html) });
  for (const p of ['/atelierfit-manifest.webmanifest', '/atelierfit-sw.js', '/icons/atelierfit-192.png', '/icons/atelierfit-512.png', '/icons/atelierfit-180.png']) {
    const a = await fetch(BASE + p);
    log('asset ' + p, { status: a.status, type: a.headers.get('content-type'), cache: a.headers.get('cache-control') });
  }
} catch (e) { log('raw', { error: String(e) }); }

async function inspect(page, name) {
  await page.waitForTimeout(4000);
  const info = await page.evaluate(async () => {
    const m = document.querySelector('link[rel="manifest"]');
    let reg = null;
    try { reg = await Promise.race([navigator.serviceWorker.ready.then(r => r.scope), new Promise(r => setTimeout(() => r('timeout'), 6000))]); } catch (e) { reg = 'err ' + e; }
    const root = document.querySelector('.atelierfit-root');
    const col = root?.firstElementChild?.nextElementSibling || root?.firstElementChild;
    const rr = root?.getBoundingClientRect();
    return {
      url: location.href,
      title: document.title,
      manifest: m?.getAttribute('href') || null,
      sw: reg,
      displayStandalone: matchMedia('(display-mode: standalone)').matches,
      viewport: document.querySelector('meta[name=viewport]')?.content,
      appleCapable: !!document.querySelector('meta[name="apple-mobile-web-app-capable"]'),
      appleIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') || null,
      hasPortfolioHeader: !!document.querySelector('header, footer'),
      innerWidth: innerWidth, innerHeight: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      rootBox: rr ? { x: Math.round(rr.x), w: Math.round(rr.width), h: Math.round(rr.height) } : null,
      bodyText: document.body.innerText.slice(0, 200),
      frameBox: (() => { const f = document.querySelector('.af-shell-frame')?.getBoundingClientRect(); return f ? { x: Math.round(f.x), w: Math.round(f.width), h: Math.round(f.height) } : null; })(),
      installButton: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).find(t => /Install app|Add to Home/.test(t)) || null,
      skeletonCard: !!document.querySelector('#initial-skeleton .isk-card'),
    };
  });
  return info;
}

// 3. Chromium (Android-like) at 360 / 390 / 430 and desktop
const br = await chromium.launch();
const sizes = [
  { name: 'android360', w: 360, h: 780, mobile: true },
  { name: 'android390', w: 390, h: 844, mobile: true },
  { name: 'android430', w: 430, h: 932, mobile: true },
  { name: 'desktop1440', w: 1440, h: 900, mobile: false },
];
for (const s of sizes) {
  const ctx = await br.newContext({
    viewport: { width: s.w, height: s.h }, isMobile: s.mobile, hasTouch: s.mobile, deviceScaleFactor: s.mobile ? 3 : 1,
    userAgent: s.mobile ? 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' : undefined,
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); }); page.on('requestfailed', r => errs.push('failed ' + r.url()));
  try {
    const resp = await page.goto(target, { waitUntil: 'networkidle', timeout: 60000 });
    const info = await inspect(page, s.name);
    info.status = resp?.status(); info.errors = errs;
    const cdp = await ctx.newCDPSession(page);
    try { info.installabilityErrors = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors; } catch (e) { info.installabilityErrors = 'n/a ' + e.message; }
    try { const am = await cdp.send('Page.getAppManifest'); info.manifestErrors = am.errors; info.manifestParsed = am.data ? JSON.parse(am.data) : null; } catch (e) { info.manifestErrors = 'n/a ' + e.message; }
    log('chromium ' + s.name, info);
    await page.screenshot({ path: `${OUT}/atelierfit_${s.name}.jpg`, type: 'jpeg', quality: 70 });
    try { await page.getByText('Continue as guest').click({ timeout: 5000 }); await page.waitForTimeout(2000); await page.screenshot({ path: `${OUT}/atelierfit_${s.name}_home.jpg`, type: 'jpeg', quality: 70 }); } catch {}
  } catch (e) { log('chromium ' + s.name, { error: String(e) }); }
  await ctx.close();
}
// StitchBook Manage tab QR at phone size
{
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + '/stitchbook?tab=manage', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    const btn = page.getByText(/AtelierFit/i).first();
    try { await btn.click({ timeout: 5000 }); await page.waitForTimeout(2000); } catch {}
    const qr = page.locator('img[alt*="QR code to open"]');
    if (await qr.count()) await qr.first().scrollIntoViewIfNeeded();
    log('stitchbook', { url: page.url(), qrShown: await qr.count(), qrText: await page.locator('text=/atelierfit/').first().textContent().catch(() => null) });
    await page.screenshot({ path: `${OUT}/stitchbook_qr_390.jpg`, type: 'jpeg', quality: 70 });
  } catch (e) { log('stitchbook', { error: String(e) }); }
  await ctx.close();
}
await br.close();

// 4. WebKit (iPhone Safari engine) at 390
const wk = await webkit.launch();
for (const d of ['iPhone 13', 'iPhone 15 Pro Max', 'iPhone SE']) {
  const ctx = await wk.newContext({ ...devices[d] });
  const page = await ctx.newPage();
  try {
    await page.goto(target, { waitUntil: 'networkidle', timeout: 60000 });
    const info = await inspect(page, d);
    log('webkit ' + d, info);
    await page.screenshot({ path: `${OUT}/atelierfit_${d.replace(/ /g, '')}.jpg`, type: 'jpeg', quality: 70 });
    try { await page.getByText('Add to Home Screen').click({ timeout: 5000 }); await page.waitForTimeout(800); await page.screenshot({ path: `${OUT}/atelierfit_${d.replace(/ /g, '')}_install_help.jpg`, type: 'jpeg', quality: 70 }); } catch {}
  } catch (e) { log('webkit ' + d, { error: String(e) }); }
  await ctx.close();
}
await wk.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
