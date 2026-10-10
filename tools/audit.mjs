import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'https://abdulwahab-portfolio-tau.vercel.app';
const OUT = 'results';
fs.mkdirSync(`${OUT}/shots`, { recursive: true });
const report = { pages: [], showcase: [], links: {}, chat: [], notes: [] };
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
const slugify = (s) => s.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 80);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const save = () => fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));

async function auditPage(browser, url, vpName, { label, full = true, clickThrough = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: VIEWPORTS[vpName].width, height: VIEWPORTS[vpName].height }, isMobile: !!VIEWPORTS[vpName].isMobile, hasTouch: !!VIEWPORTS[vpName].hasTouch, deviceScaleFactor: VIEWPORTS[vpName].deviceScaleFactor || 1, userAgent: vpName === 'mobile' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
  const page = await ctx.newPage();
  const consoleErrors = [], failed = [], pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 300)));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(0, 200)}`); });
  page.on('requestfailed', (r) => { const f = r.failure()?.errorText || ''; if (!/ERR_ABORTED/.test(f)) failed.push(`FAILED ${f} ${r.url().slice(0, 200)}`); });
  const entry = { url, viewport: vpName, label };
  const t0 = Date.now();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    entry.status = resp?.status();
    entry.finalUrl = page.url();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await sleep(2500);
    // scroll to trigger lazy content / animations
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); }).catch(() => {});
    await sleep(1500);
    entry.loadMs = Date.now() - t0;
    entry.title = await page.title();
    const info = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const imgs = [...document.images].map((i) => ({ src: i.currentSrc || i.src, ok: i.complete && i.naturalWidth > 0, alt: i.getAttribute('alt'), vis: vis(i) }));
      const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, text: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 60), target: a.target, vis: vis(a) }));
      const buttons = [...document.querySelectorAll('button, [role=button]')].filter(vis).map((b) => ({ text: (b.innerText || b.getAttribute('aria-label') || b.title || '').trim().slice(0, 60), disabled: b.disabled }));
      const docW = document.documentElement.scrollWidth, winW = window.innerWidth;
      const wide = [];
      if (docW > winW + 2) { for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.right > winW + 4 && r.width > 0 && getComputedStyle(el).position !== 'fixed') { wide.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).slice(0, 50)} right=${Math.round(r.right)}`); if (wide.length > 8) break; } } }
      const text = document.body.innerText;
      const smallTap = [...document.querySelectorAll('a, button')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return r.height < 24 || r.width < 24; }).length;
      return { imgs, links, buttons, docW, winW, wide, textLen: text.length, bodyStart: text.slice(0, 1500), h1: [...document.querySelectorAll('h1')].map((h) => h.innerText.trim().slice(0, 120)), metaDesc: document.querySelector('meta[name=description]')?.content, lang: document.documentElement.lang, dir: document.documentElement.dir, smallTap, placeholders: (text.match(/lorem ipsum|TODO|undefined|NaN|\[object Object\]|null null|{{|}}/gi) || []).slice(0, 10) };
    });
    Object.assign(entry, { brokenImages: info.imgs.filter((i) => !i.ok && i.vis !== false).map((i) => i.src).filter(Boolean), imagesNoAlt: info.imgs.filter((i) => i.alt === null).length, imageCount: info.imgs.length, links: info.links, buttons: info.buttons, horizontalOverflow: info.docW > info.winW + 2 ? { docW: info.docW, winW: info.winW, culprits: info.wide } : null, h1: info.h1, metaDesc: info.metaDesc, lang: info.lang, dir: info.dir, textLen: info.textLen, bodyStart: info.bodyStart, smallTapTargets: info.smallTap, placeholders: info.placeholders });
    const file = `${OUT}/shots/${label || slugify(url)}_${vpName}.jpg`;
    await page.screenshot({ path: file, fullPage: full, type: 'jpeg', quality: 55, timeout: 30000 }).catch(async () => page.screenshot({ path: file, type: 'jpeg', quality: 55 }));
    entry.shot = file;
  } catch (e) { entry.error = String(e.message).slice(0, 400); try { await page.screenshot({ path: `${OUT}/shots/${label || slugify(url)}_${vpName}_ERR.jpg`, type: 'jpeg', quality: 55 }); } catch {} }
  Object.assign(entry, { consoleErrors: [...new Set(consoleErrors)].slice(0, 15), pageErrors: [...new Set(pageErrors)].slice(0, 10), failedRequests: [...new Set(failed)].slice(0, 25) });
  await ctx.close();
  return entry;
}

async function checkLinks(urls) {
  for (const u of urls) {
    if (report.links[u] || !/^https?:/.test(u)) continue;
    try {
      let r = await fetch(u, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141 Safari/537.36' }, signal: AbortSignal.timeout(20000) });
      report.links[u] = { status: r.status, final: r.url };
    } catch (e) { report.links[u] = { error: String(e.message).slice(0, 120) }; }
  }
}

async function chat(questions) {
  // Each conversation: array of user turns; history carried over.
  for (const convo of questions) {
    const history = []; const transcript = { name: convo.name, turns: [] };
    for (const q of convo.turns) {
      let answer = '', err = null, status = null;
      try {
        const r = await fetch(`${BASE}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE, 'user-agent': 'Mozilla/5.0 visitor-audit' }, body: JSON.stringify({ message: q, history }), signal: AbortSignal.timeout(60000) });
        status = r.status;
        const txt = await r.text();
        if (!r.ok) err = txt.slice(0, 300);
        for (const ev of txt.split('\n\n')) { const line = ev.split('\n').find((l) => l.startsWith('data: ')); if (!line) continue; try { const d = JSON.parse(line.slice(6)); if (d.type === 'delta') answer += d.text; else if (d.type !== 'delta') transcript.turns.push({ event: d }); } catch {} }
      } catch (e) { err = String(e.message); }
      transcript.turns.push({ q, status, answer, err });
      if (answer) { history.push({ role: 'user', content: q }, { role: 'assistant', content: answer.slice(0, 3900) }); }
      save();
      await sleep(9000);
    }
    report.chat.push(transcript); save();
  }
}

const browser = await chromium.launch();
let projects = [];
try { projects = await (await fetch(`${BASE}/api/projects`)).json(); } catch (e) { report.notes.push('projects api failed ' + e.message); }
report.projectsApi = (Array.isArray(projects) ? projects : []).map((p) => ({ slug: p.slug, title: p.title, live_url: p.live_url, github_url: p.github_url, category: p.category, featured: p.featured, image: p.image_url || p.cover_image || p.image }));
save();

const routes = ['/', '/about', '/skills', '/projects', '/certificates', '/testimonials', '/resume', '/contact', '/admin', '/stitchbook', '/atelierfit', '/phoneframe', '/this-page-does-not-exist', ...report.projectsApi.map((p) => `/projects/${p.slug}`)];
for (const r of routes) for (const vp of ['desktop', 'mobile']) { report.pages.push(await auditPage(browser, BASE + r, vp, { label: 'pf' + slugify(r || 'home') })); save(); }

// language variants of home on mobile
for (const lang of ['fr', 'ar']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try { await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 }); const b = page.locator(`button[aria-label*="${lang === 'fr' ? 'Fr' : 'Ar'}" i]`).first(); if (await b.count()) await b.click({ timeout: 5000 }).catch(() => {}); else { const m = page.locator('button[aria-label*="menu" i]').first(); if (await m.count()) { await m.click().catch(() => {}); await sleep(800); await page.locator(`button[aria-label*="${lang === 'fr' ? 'Fr' : 'Ar'}" i]`).first().click({ timeout: 5000 }).catch(() => {}); } } await sleep(3000); await page.keyboard.press('Escape').catch(()=>{}); await page.screenshot({ path: `${OUT}/shots/lang_${lang}_mobile.jpg`, fullPage: true, type: 'jpeg', quality: 55 }); report.notes.push(`lang ${lang}: dir=${await page.evaluate(() => document.documentElement.dir)} lang=${await page.evaluate(() => document.documentElement.lang)} h1=${await page.evaluate(() => document.querySelector('h1')?.innerText)}`); } catch (e) { report.notes.push(`lang ${lang} failed ${e.message}`); }
  await ctx.close();
}

// mobile nav menu + contact form + chat widget UI
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 }); await sleep(2000);
    const menu = page.locator('button[aria-label*="menu" i], button[aria-label*="navigation" i]').first();
    report.notes.push('mobile menu button count ' + await menu.count());
    if (await menu.count()) { await menu.click().catch((e) => report.notes.push('menu click ' + e.message)); await sleep(1200); await page.screenshot({ path: `${OUT}/shots/ui_mobile_menu.jpg`, type: 'jpeg', quality: 55 }); }
    await page.goto(BASE + '/contact', { waitUntil: 'networkidle' }); await sleep(2000);
    const submit = page.locator('form button[type=submit], form button').last();
    const before = await submit.evaluate((b) => ({ bg: getComputedStyle(b).backgroundColor, color: getComputedStyle(b).color, disabled: b.disabled, text: b.innerText })).catch((e) => ({ err: e.message }));
    const inputs = page.locator('form input:not([type=hidden]):not([type=checkbox]), form textarea');
    const n = await inputs.count(); report.notes.push('contact form fields ' + n);
    for (let i = 0; i < n; i++) { const el = inputs.nth(i); const type = await el.getAttribute('type'); const name = (await el.getAttribute('name')) || (await el.getAttribute('placeholder')) || ''; await el.fill(type === 'email' || /mail/i.test(name) ? 'visitor.test@example.com' : /phone|tel/i.test(name) ? '+2290100000000' : 'Visitor audit test, please ignore').catch(() => {}); }
    await sleep(800);
    const after = await submit.evaluate((b) => ({ bg: getComputedStyle(b).backgroundColor, color: getComputedStyle(b).color, disabled: b.disabled, text: b.innerText })).catch((e) => ({ err: e.message }));
    report.contactButton = { before, after };
    await page.screenshot({ path: `${OUT}/shots/ui_contact_filled_mobile.jpg`, fullPage: true, type: 'jpeg', quality: 55 });
    // chat widget
    await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await sleep(2000);
    const opener = page.locator('button[aria-label*="assistant" i], button[aria-label*="chat" i]').first();
    report.notes.push('chat opener count ' + await opener.count());
    if (await opener.count()) {
      await opener.click().catch((e) => report.notes.push('chat open ' + e.message)); await sleep(1500);
      await page.screenshot({ path: `${OUT}/shots/ui_chat_open_mobile.jpg`, type: 'jpeg', quality: 55 });
      const box = page.locator('textarea, input[type=text]').last();
      if (await box.count()) { await box.fill('Hi! Can you show me a project I can try live?'); await box.press('Enter'); await sleep(20000); await page.screenshot({ path: `${OUT}/shots/ui_chat_answer_mobile.jpg`, type: 'jpeg', quality: 55 }); }
    }
  } catch (e) { report.notes.push('ui flow failed ' + e.message); }
  await ctx.close(); save();
}

// Showcase live demos
const liveUrls = [...new Set(report.projectsApi.map((p) => p.live_url).filter((u) => u && /^https?:/.test(u)))];
for (const u of ['https://shin-orne.vercel.app', ...liveUrls]) {
  if (report.showcase.find((s) => s.url === u)) continue;
  for (const vp of ['desktop', 'mobile']) {
    const e = await auditPage(browser, u, vp, { label: 'sc_' + slugify(u) });
    report.showcase.push(e); save();
  }
  // one level of same-origin internal pages (desktop only, max 8)
  const first = report.showcase.find((s) => s.url === u && s.viewport === 'desktop');
  const origin = (() => { try { return new URL(first?.finalUrl || u).origin; } catch { return null; } })();
  const internal = [...new Set((first?.links || []).map((l) => l.href.split('#')[0]).filter((h) => origin && h.startsWith(origin) && h !== origin + '/' && h !== u && h !== u + '/'))].slice(0, 8);
  for (const h of internal) { const e = await auditPage(browser, h, 'desktop', { label: 'sc_' + slugify(h), full: false }); e.parent = u; report.showcase.push(e); save(); }
}

// link check: every distinct link seen anywhere
const allLinks = new Set();
for (const p of [...report.pages, ...report.showcase]) for (const l of p.links || []) allLinks.add(l.href.split('#')[0]);
await checkLinks([...allLinks].filter((u) => !/^mailto:|^tel:|wa\.me|linkedin\.com/.test(u)).slice(0, 400));
save();

await chat(JSON.parse(fs.readFileSync('tools/questions.json', 'utf8')));
await browser.close();
save();
console.log('done', report.pages.length, report.showcase.length, Object.keys(report.links).length, report.chat.length);
