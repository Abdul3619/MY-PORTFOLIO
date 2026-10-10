import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://abdulwahab-portfolio-tau.vercel.app';
const OUT = 'results2'; fs.mkdirSync(`${OUT}/shots`, { recursive: true });
const R = { notes: [], chat: [], nan: {} };
const save = () => fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(R, null, 2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name, full = false) => page.screenshot({ path: `${OUT}/shots/${name}.jpg`, type: 'jpeg', quality: 55, fullPage: full }).catch((e) => R.notes.push(`shot ${name} ${e.message}`));
const browser = await chromium.launch();
const desk = () => browser.newContext({ viewport: { width: 1440, height: 900 } });
const mob = () => browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

// 1. Home: slow scroll, viewport shots
for (const [name, mk] of [['desktop', desk], ['mobile', mob]]) {
  const ctx = await mk(); const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 }); await sleep(2500);
  const H = await page.evaluate(() => document.body.scrollHeight); const vh = name === 'desktop' ? 900 : 844;
  let i = 0;
  for (let y = 0; y < H && i < 14; y += vh * 0.9, i++) { await page.mouse.wheel(0, i === 0 ? 0 : vh * 0.9); await sleep(1600); await shot(page, `home_scroll_${name}_${String(i).padStart(2, '0')}`); }
  R.nan[`home_${name}`] = await page.evaluate(() => { const t = document.body.innerText; const out = []; const re = /nan/gi; let m; while ((m = re.exec(t)) && out.length < 5) out.push(t.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\n/g, ' | ')); return out; });
  if (name === 'mobile') R.notes.push('mobile nav: ' + JSON.stringify(await page.evaluate(() => { const n = document.querySelector('nav'); if (!n) return null; const s = [...n.querySelectorAll('*')].find((e) => e.scrollWidth > e.clientWidth + 5); return { navW: n.clientWidth, scrollEl: s ? { cls: String(s.className).slice(0, 80), sw: s.scrollWidth, cw: s.clientWidth, overflowX: getComputedStyle(s).overflowX } : null, items: [...n.querySelectorAll('a,button')].map((a) => a.innerText.trim()).filter(Boolean) }; })));
  await ctx.close(); save();
}
// nan on crouch-end
{ const ctx = await desk(); const page = await ctx.newPage(); for (const u of ['https://crouch-end.vercel.app/', 'https://crouch-end.vercel.app/services?type=commercial']) { await page.goto(u, { waitUntil: 'networkidle' }); await sleep(2000); R.nan[u] = await page.evaluate(() => { const t = document.body.innerText; const out = []; const re = /\bnan\b/gi; let m; while ((m = re.exec(t)) && out.length < 5) out.push(t.slice(Math.max(0, m.index - 80), m.index + 40).replace(/\n/g, ' | ')); return out; }); } await ctx.close(); }

// 2. StitchBook tabs
for (const [name, mk] of [['desktop', desk], ['mobile', mob]]) {
  const ctx = await mk(); const page = await ctx.newPage();
  await page.goto(BASE + '/stitchbook', { waitUntil: 'networkidle', timeout: 60000 }); await sleep(2000);
  for (const tab of ['Orders', 'Inventory', 'Live', 'Manage', 'Desktop app']) {
    const t = page.getByText(tab, { exact: true }).first();
    if (!(await t.count())) { R.notes.push(`stitchbook ${name}: tab ${tab} not found`); continue; }
    await t.click({ timeout: 5000 }).catch((e) => R.notes.push(`stitchbook ${name} ${tab} click ${e.message.slice(0, 120)}`)); await sleep(2500);
    await shot(page, `stitchbook_${name}_${tab.replace(' ', '_')}`, name === 'desktop');
    R.notes.push(`stitchbook ${name} ${tab}: url=${page.url()} text=${(await page.evaluate(() => document.querySelector('main')?.innerText || document.body.innerText)).slice(0, 600).replace(/\n/g, ' | ')}`);
  }
  await ctx.close(); save();
}

// 3. AtelierFit + Atelier Noir: first steps of ordering (no submission)
{
  const ctx = await mob(); const page = await ctx.newPage();
  await page.goto(BASE + '/atelierfit', { waitUntil: 'networkidle', timeout: 60000 }); await sleep(2500); await shot(page, 'atelierfit_m_0');
  R.notes.push('atelierfit buttons: ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('button,a')].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 30))));
  for (let i = 1; i <= 4; i++) { const b = page.locator('button:visible').filter({ hasNotText: /back|close|cancel/i }).first(); if (!(await b.count())) break; const txt = await b.innerText().catch(() => ''); await b.click({ timeout: 4000 }).catch(() => {}); await sleep(2000); await shot(page, `atelierfit_m_${i}`); R.notes.push(`atelierfit step ${i} clicked "${txt.slice(0, 40)}"`); }
  await ctx.close();
}

// 4. Lock buttons on /projects
{
  const ctx = await desk(); const page = await ctx.newPage();
  await page.goto(BASE + '/projects', { waitUntil: 'networkidle' }); await sleep(2000);
  const lock = page.locator('button[aria-label*="locked" i], button[title*="locked" i]').first();
  if (await lock.count()) { await lock.click().catch(() => {}); await sleep(3000); await shot(page, 'projects_lock_click'); R.notes.push('after lock click: ' + (await page.evaluate(() => document.body.innerText.slice(-800))).replace(/\n/g, ' | ')); }
  await ctx.close();
}

// 5. Chat UI on desktop, wait for answer up to 60s
{
  const ctx = await desk(); const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await sleep(2000);
  await page.locator('button[aria-label*="assistant" i], button[aria-label*="chat" i]').first().click().catch(() => {}); await sleep(1500);
  const box = page.locator('textarea, input[type=text]').last(); const t0 = Date.now();
  await box.fill('Is there a desktop app for StitchBook I can download?'); await box.press('Enter');
  for (let i = 0; i < 30; i++) { await sleep(2000); const st = await page.evaluate(() => document.body.innerText.includes('Thinking')); if (!st && i > 2) break; }
  R.notes.push(`chat ui answer after ${Date.now() - t0}ms`); await sleep(6000); await shot(page, 'chat_ui_desktop');
  await ctx.close();
}
save();

// 6. Chat API retries, slow
const convos = JSON.parse(fs.readFileSync('tools/questions2.json', 'utf8'));
for (const convo of convos) {
  const history = []; const tr = { name: convo.name, turns: [] };
  for (const q of convo.turns) {
    let answer = '', events = [], status = null; const t0 = Date.now();
    try { const r = await fetch(`${BASE}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ message: q, history }), signal: AbortSignal.timeout(90000) }); status = r.status; const txt = await r.text(); for (const ev of txt.split('\n\n')) { const line = ev.split('\n').find((l) => l.startsWith('data: ')); if (!line) continue; try { const d = JSON.parse(line.slice(6)); if (d.type === 'delta') answer += d.text; else events.push(d); } catch {} } if (!r.ok) events.push({ body: txt.slice(0, 300) }); } catch (e) { events.push({ err: e.message }); }
    tr.turns.push({ q, status, ms: Date.now() - t0, answer, events });
    if (answer) history.push({ role: 'user', content: q }, { role: 'assistant', content: answer.slice(0, 3900) });
    save(); await sleep(30000);
  }
  R.chat.push(tr); save();
}
await browser.close(); save(); console.log('done');
