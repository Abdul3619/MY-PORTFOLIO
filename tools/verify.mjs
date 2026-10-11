import { chromium } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const PF = 'https://abdulwahab-portfolio-tau.vercel.app';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1376, height: 900 } })).newPage();
const out = {};
for (const s of ['atelier-noir','stitchbook','atelierfit','phoneframe','h-orizon-hotel','Azure-hotel','crouchend-electrical','lamasat-salon','val-car','daqn-plus']) {
  const r = await page.request.get(`${PF}/projects/${s}-cover.png`); out[s] = [r.status(), r.headers()['content-type']];
}
await page.goto(PF + '/projects', { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(4000);
for (let y = 0; y < 6000; y += 700) { await page.mouse.wheel(0, 700); await page.waitForTimeout(500); }
await page.waitForTimeout(2000);
out.imgs = await page.evaluate(() => [...document.images].map(i => [i.getAttribute('src'), i.naturalWidth]).filter(x => /projects|supabase/.test(x[0] || '')));
await page.screenshot({ path: `${OUT}/projects-page.png`, fullPage: true });
await page.goto(PF + '/projects/atelier-noir', { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/detail-atelier-noir.png` });
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(out, null, 2));
await browser.close();
