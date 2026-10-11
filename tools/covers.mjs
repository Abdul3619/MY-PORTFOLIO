import { chromium } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT || 'results-covers';
fs.mkdirSync(OUT, { recursive: true });
const SB = 'https://aqilclozwukdnogqcmsy.supabase.co/storage/v1/object/public';
const PF = 'https://abdulwahab-portfolio-tau.vercel.app';
const targets = JSON.parse(fs.readFileSync('tools/targets.json', 'utf8'));
const report = [];
const browser = await chromium.launch();
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.evaluate(async () => {
    const imgs = [...document.images];
    await Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 8000); })));
  }).catch(() => {});
}
async function dismissCookies(page) {
  const re = /^(accept( all)?( cookies)?|i agree|agree|got it|allow all|ok|okay|accepter|tout accepter)$/i;
  for (const b of await page.locator('button, a[role=button]').all()) {
    const t = ((await b.innerText().catch(() => '')) || '').trim();
    if (re.test(t) && await b.isVisible().catch(() => false)) { await b.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(600); }
  }
}
for (const t of targets) {
  const ctx = await browser.newContext({ viewport: { width: 1376, height: 768 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const r = { slug: t.slug, url: t.url };
  try {
    const resp = await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    r.status = resp && resp.status();
    await settle(page);
    await page.waitForTimeout(t.wait || 3500);
    await dismissCookies(page);
    for (const step of t.steps || []) {
      if (step.click) { await page.locator(step.click).first().click({ timeout: 8000 }).catch(e => errs.push('click ' + step.click + ': ' + String(e).slice(0, 120))); }
      if (step.goto) await page.goto(step.goto, { waitUntil: 'domcontentloaded' });
      if (step.wait) await page.waitForTimeout(step.wait);
      if (step.eval) await page.evaluate(step.eval).catch(e => errs.push(String(e).slice(0, 120)));
      if (step.shot) { await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/${step.shot}.png` }); }
      await settle(page);
    }
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${t.slug}-cover.png` });
    r.title = await page.title();
    r.h1 = await page.locator('h1').allInnerTexts().catch(() => []);
    r.text = (await page.locator('body').innerText().catch(() => '')).slice(0, 2500);
    r.buttons = (await page.locator('button, a').allInnerTexts().catch(() => [])).map(s => s.trim()).filter(Boolean).slice(0, 80);
  } catch (e) { r.error = String(e).slice(0, 300); }
  r.errs = errs;
  report.push(r);
  await ctx.close();
}
/* download current covers for comparison
for (const t of targets) for (const [k, u] of Object.entries(t.current || {})) {
  try {
    const full = u.startsWith('/') ? PF + u : u;
    const res = await fetch(full); const buf = Buffer.from(await res.arrayBuffer());
    const ext = (u.split('?')[0].split('.').pop() || 'img').slice(0, 4);
    fs.writeFileSync(`${OUT}/old-${t.slug}-${k}.${ext}`, buf);
  } catch (e) {}
}
*/
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
