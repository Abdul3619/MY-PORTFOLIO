// Visitor sweep: every page, link and button on the portfolio and each showcase project, desktop + phone.
import { chromium, devices } from 'playwright';
import fs from 'fs';

const OUT = process.env.OUT || 'results3';
const BASE = 'https://abdulwahab-portfolio-tau.vercel.app';
fs.mkdirSync(`${OUT}/shots`, { recursive: true });
const report = { startedAt: new Date().toISOString(), pages: [], projectButtons: [], showcase: [], chat: [], checks: [], errors: [] };
const save = () => fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
const slug = (s) => s.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 90);
const VIEWPORTS = { desktop: { viewport: { width: 1440, height: 900 } }, mobile: { ...devices['iPhone 13'] } };

const browser = await chromium.launch();
const ctxs = {};
for (const [k, v] of Object.entries(VIEWPORTS)) ctxs[k] = await browser.newContext({ ...v, ignoreHTTPSErrors: true });

async function inspect(page, url, vp, label, { shot = true } = {}) {
  const consoleErrors = [];
  const failed = [];
  const onC = (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); };
  const onF = (r) => failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 200)}`);
  const onR = (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) failed.push(`${r.status()} ${r.url().slice(0, 200)}`); };
  page.on('console', onC); page.on('requestfailed', onF); page.on('response', onR);
  const t0 = Date.now();
  let status = null, err = null;
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    status = resp?.status() ?? null;
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    // scroll to trigger lazy images
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(800);
  } catch (e) { err = String(e).slice(0, 300); }
  const info = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const imgs = [...document.images];
    return {
      title: document.title,
      h1: [...document.querySelectorAll('h1')].map(h => h.innerText.trim()).slice(0, 3),
      brokenImages: imgs.filter(i => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.src)).map(i => i.currentSrc || i.src).slice(0, 20),
      imageCount: imgs.length,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      links: [...document.querySelectorAll('a[href]')].map(a => ({ href: a.href, text: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 60), target: a.target, vis: vis(a) })).slice(0, 200),
      buttons: [...document.querySelectorAll('button')].filter(vis).map(b => (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 50)).slice(0, 80),
      bodyText: document.body.innerText.slice(0, 1500),
    };
  }).catch((e) => ({ evalError: String(e) }));
  page.off('console', onC); page.off('requestfailed', onF); page.off('response', onR);
  const file = `${label}_${vp}.jpg`;
  if (shot) await page.screenshot({ path: `${OUT}/shots/${file}`, fullPage: vp === 'mobile' ? false : false, type: 'jpeg', quality: 55 }).catch(() => {});
  const rec = { url, vp, label, status, finalUrl: page.url(), ms: Date.now() - t0, err, consoleErrors: consoleErrors.slice(0, 10), failed: [...new Set(failed)].slice(0, 15), shot: file, ...info };
  report.pages.push(rec); save();
  return rec;
}

async function linkStatus(href) {
  try { const r = await fetch(href, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(45000) }); return r.status; } catch (e) { return 'ERR ' + String(e).slice(0, 80); }
}

// ---------- 1. Portfolio pages ----------
const projects = await (await fetch(`${BASE}/api/projects`)).json().catch(() => []);
const projList = Array.isArray(projects) ? projects : (projects.data || []);
report.projectsApi = projList.map(p => ({ slug: p.slug, title: p.title, live_url: p.live_url, status: p.status, has_dashboard: p.has_dashboard, thumbnail_url: p.thumbnail_url, hero_image_url: p.hero_image_url }));
const pfPaths = ['/', '/about', '/skills', '/projects', '/resume', '/contact', '/certificates', '/testimonials', '/stitchbook', '/atelierfit', '/phoneframe', '/admin', '/no-such-page', ...projList.map(p => `/projects/${p.slug}`)];
for (const vp of Object.keys(VIEWPORTS)) {
  const page = await ctxs[vp].newPage();
  for (const p of pfPaths) await inspect(page, BASE + p, vp, 'pf' + slug(p));
  await page.close();
}

// all unique links found on portfolio pages -> status
const allLinks = new Set();
for (const r of report.pages) for (const l of r.links || []) if (/^https?:/.test(l.href) && !l.href.startsWith('mailto')) allLinks.add(l.href.split('#')[0]);
report.linkStatus = {};
for (const h of allLinks) report.linkStatus[h] = await linkStatus(h);
save();

// ---------- 2. Project detail buttons (Visit Live Site / Dashboard) ----------
{
  const page = await ctxs.desktop.newPage();
  for (const p of projList) {
    await page.goto(`${BASE}/projects/${p.slug}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const btns = await page.evaluate(() => [...document.querySelectorAll('a,button')].filter(e => /live|visit|dashboard|demo|open|download|try/i.test(e.innerText || '')).map(e => ({ tag: e.tagName, text: e.innerText.trim().slice(0, 60), href: e.href || null })).slice(0, 12));
    for (const b of btns) {
      const rec = { project: p.slug, ...b };
      if (b.href && /^https?:/.test(b.href)) rec.status = await linkStatus(b.href);
      else if (b.tag === 'BUTTON') {
        try {
          const [popup] = await Promise.all([
            page.waitForEvent('popup', { timeout: 8000 }).catch(() => null),
            page.getByRole('button', { name: b.text }).first().click({ timeout: 5000 }),
          ]);
          await page.waitForTimeout(2500);
          rec.after = popup ? popup.url() : page.url();
          rec.afterText = (popup ? await popup.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => '') : await page.evaluate(() => document.body.innerText.slice(0, 300)));
          if (popup) await popup.close();
          await page.goto(`${BASE}/projects/${p.slug}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
        } catch (e) { rec.err = String(e).slice(0, 200); }
      }
      report.projectButtons.push(rec); save();
    }
    await page.screenshot({ path: `${OUT}/shots/detail_${slug(p.slug)}.jpg`, type: 'jpeg', quality: 55 }).catch(() => {});
  }
  await page.close();
}

// ---------- 3. Showcase sites: every internal link + every visible button on home ----------
const extra = ['https://atelier-noir-official.vercel.app', 'https://shin-orne.vercel.app', 'https://horizon-br6n.vercel.app'];
const liveSites = [...new Set([...projList.map(p => p.live_url).filter(u => u && !u.startsWith(BASE)), ...extra].map(u => u.replace(/\/$/, '')))];
for (const site of liveSites) {
  const siteRec = { site, pages: [], buttons: [] };
  report.showcase.push(siteRec);
  for (const vp of Object.keys(VIEWPORTS)) {
    const page = await ctxs[vp].newPage();
    const home = await inspect(page, site, vp, 'sc' + slug(site));
    siteRec.pages.push({ url: site, vp, status: home.status, ms: home.ms, broken: home.brokenImages, overflowX: home.overflowX });
    if (vp === 'desktop') {
      const origin = new URL(site).origin;
      const internal = [...new Set((home.links || []).map(l => l.href.split('#')[0]).filter(h => h.startsWith(origin) && h !== site && h !== site + '/'))].slice(0, 25);
      for (const h of internal) {
        const r = await inspect(page, h, vp, 'sc' + slug(h));
        siteRec.pages.push({ url: h, vp, status: r.status, broken: r.brokenImages, h1: r.h1, err: r.err, overflowX: r.overflowX });
      }
      const external = [...new Set((home.links || []).map(l => l.href).filter(h => /^https?:/.test(h) && !h.startsWith(origin)))].slice(0, 20);
      siteRec.external = {};
      for (const h of external) siteRec.external[h] = await linkStatus(h);
      // click every visible button on the home page
      await page.goto(site, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
      const count = await page.locator('button:visible').count().catch(() => 0);
      for (let i = 0; i < Math.min(count, 18); i++) {
        const rec = { i };
        try {
          const b = page.locator('button:visible').nth(i);
          rec.text = ((await b.innerText().catch(() => '')) || (await b.getAttribute('aria-label')) || '').trim().slice(0, 50);
          const errs = []; const onE = (e) => errs.push(String(e).slice(0, 200)); page.on('pageerror', onE);
          await b.click({ timeout: 4000 });
          await page.waitForTimeout(1200);
          page.off('pageerror', onE);
          rec.url = page.url(); rec.pageErrors = errs;
          rec.dialog = await page.locator('[role=dialog]:visible').count().catch(() => 0);
          if (errs.length) await page.screenshot({ path: `${OUT}/shots/btnerr_${slug(site)}_${i}.jpg`, type: 'jpeg', quality: 50 });
        } catch (e) { rec.err = String(e).split('\n')[0].slice(0, 160); }
        siteRec.buttons.push(rec);
        await page.goto(site, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
      }
    } else {
      // phone menu check
      const menu = page.locator('button[aria-label*="menu" i], button[aria-label*="nav" i], button:has(svg.lucide-menu)').first();
      const has = await menu.count().catch(() => 0);
      const rec = { site, mobileMenuButton: has > 0 };
      if (has) {
        try { await menu.click({ timeout: 4000 }); await page.waitForTimeout(900); rec.linksAfterOpen = await page.locator('a:visible').count(); await page.screenshot({ path: `${OUT}/shots/menu_${slug(site)}.jpg`, type: 'jpeg', quality: 55 }); } catch (e) { rec.err = String(e).slice(0, 150); }
      }
      siteRec.mobileMenu = rec;
    }
    save();
    await page.close();
  }
}

// ---------- 4. Portfolio phone menu + contact send button ----------
{
  const page = await ctxs.mobile.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  const menuBtn = page.locator('button[aria-controls="mobile-menu"]');
  const rec = { name: 'portfolio-mobile-menu', hasButton: (await menuBtn.count()) > 0 };
  if (rec.hasButton) {
    await menuBtn.click(); await page.waitForTimeout(700);
    rec.items = await page.locator('#mobile-menu a, #mobile-menu button').allInnerTexts();
    await page.screenshot({ path: `${OUT}/shots/pf_mobile_menu_open.jpg`, type: 'jpeg', quality: 60 });
    await page.locator('#mobile-menu a', { hasText: 'Contact' }).first().click().catch(() => {});
    await page.waitForTimeout(1500); rec.afterContactTap = page.url();
  } else {
    rec.navItems = await page.locator('nav a, nav button').allInnerTexts().catch(() => []);
  }
  report.checks.push(rec);
  await page.goto(BASE + '/contact', { waitUntil: 'networkidle' }).catch(() => {});
  const btn = page.locator('form button[type=submit]');
  const before = await btn.evaluate(e => getComputedStyle(e).backgroundColor).catch(() => null);
  await page.locator('form input').nth(0).fill('Visitor sweep (not sent)').catch(() => {});
  await page.locator('form input[type=email], form input').nth(1).fill('sweep@example.com').catch(() => {});
  await page.locator('form input').nth(2).fill('Sweep check').catch(() => {});
  await page.locator('form textarea').fill('Checking the button colour only. Not submitted.').catch(() => {});
  await page.waitForTimeout(500);
  const after = await btn.evaluate(e => getComputedStyle(e).backgroundColor).catch(() => null);
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: `${OUT}/shots/pf_contact_filled.jpg`, type: 'jpeg', quality: 60 });
  report.checks.push({ name: 'contact-send-colour', before, after, changed: before !== after, h1: await page.locator('h1').first().innerText().catch(() => null) });
  save(); await page.close();
}

// ---------- 5. AtelierFit Google sign-in ----------
{
  const page = await ctxs.mobile.newPage();
  await page.goto(BASE + '/atelierfit', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  const rec = { name: 'atelierfit-google' };
  try {
    const g = page.getByText('Continue with Google').first();
    rec.visible = await g.isVisible().catch(() => false);
    if (!rec.visible) { // maybe behind a sign-in step
      const s = page.getByRole('button', { name: /sign in|log in|account|get started|start/i }).first();
      if (await s.count()) { await s.click().catch(() => {}); await page.waitForTimeout(1200); }
      rec.visible = await g.isVisible().catch(() => false);
    }
    if (rec.visible) {
      const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 8000 }).catch(() => null), g.click()]);
      await page.waitForTimeout(5000);
      const tgt = popup || page;
      rec.url = tgt.url(); rec.text = await tgt.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => '');
      await tgt.screenshot({ path: `${OUT}/shots/atelierfit_google.jpg`, type: 'jpeg', quality: 55 }).catch(() => {});
    }
  } catch (e) { rec.err = String(e).slice(0, 200); }
  report.checks.push(rec); save(); await page.close();
}

// ---------- 6. StitchBook tabs ----------
for (const vp of Object.keys(VIEWPORTS)) {
  const page = await ctxs[vp].newPage();
  await page.goto(BASE + '/stitchbook', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  const tabs = await page.locator('[role=tab], nav button, aside button').allInnerTexts().catch(() => []);
  const rec = { name: 'stitchbook-tabs', vp, tabs: tabs.map(t => t.trim()).filter(Boolean).slice(0, 20), visited: [] };
  for (const t of rec.tabs.slice(0, 10)) {
    try {
      await page.getByRole('button', { name: t, exact: true }).first().click({ timeout: 4000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT}/shots/stitchbook_${vp}_${slug(t)}.jpg`, type: 'jpeg', quality: 55 });
      rec.visited.push({ tab: t, text: (await page.locator('main').first().innerText().catch(() => '')).slice(0, 600) });
    } catch (e) { rec.visited.push({ tab: t, err: String(e).split('\n')[0].slice(0, 120) }); }
  }
  report.checks.push(rec); save(); await page.close();
}

// ---------- 7. AI Outreach cold start ----------
{
  const t0 = Date.now(); const tries = [];
  for (let i = 0; i < 8; i++) { const s = await linkStatus('https://ai-outreach-flpr.onrender.com'); tries.push(s); if (s === 200) break; await new Promise(r => setTimeout(r, 15000)); }
  report.checks.push({ name: 'ai-outreach-render', tries, secondsToReady: Math.round((Date.now() - t0) / 1000) }); save();
}

// ---------- 8. AI assistant ----------
const QUESTIONS = [
  'What is your contact email?',
  'What are his main skills?',
  'Give me the live link for every project in the portfolio.',
  'Which projects have a dashboard, and how do I open each dashboard?',
  'Can I open the StitchBook dashboard? Where is the Manage tab?',
  'What is the live link for Shin Orne and does it have an admin dashboard?',
  'Where is he based and how much does a website cost?',
];
for (const q of QUESTIONS) {
  const rec = { q };
  try {
    const r = await fetch(`${BASE}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ message: q, history: [] }), signal: AbortSignal.timeout(90000) });
    rec.status = r.status;
    const txt = await r.text();
    let answer = '', events = [];
    for (const line of txt.split('\n')) if (line.startsWith('data: ')) { try { const e = JSON.parse(line.slice(6)); if (e.type === 'delta') answer += e.text; else events.push(e); } catch {} }
    rec.answer = answer || txt.slice(0, 400); rec.events = events.slice(0, 5);
  } catch (e) { rec.err = String(e).slice(0, 200); }
  report.chat.push(rec); save();
  await new Promise(r => setTimeout(r, 7000));
}

report.finishedAt = new Date().toISOString(); save();
await browser.close();
