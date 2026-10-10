import fs from 'fs';
const BASE = 'https://abdulwahab-portfolio-tau.vercel.app';
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const out = [];
const qs = ['What is your contact email?', 'What are his main skills?', 'Give me the live link for every project.'];
for (const q of qs) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ message: q, history: [] }) });
  const txt = await r.text(); let answer = ''; const ev = [];
  for (const l of txt.split('\n')) if (l.startsWith('data: ')) { try { const e = JSON.parse(l.slice(6)); e.type === 'delta' ? (answer += e.text) : ev.push(e); } catch {} }
  out.push({ q, status: r.status, ms: Date.now() - t0, answer, ev });
  await new Promise(r => setTimeout(r, 6000));
}
for (const slug of ['shin-orne', 'atelier-noir', 'h-orizon-hotel']) {
  const r = await fetch(`${BASE}/api/chat/dashboard-link`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ slug }) });
  const j = await r.json().catch(() => ({}));
  let landed = null;
  if (j.url) { const p = await fetch(j.url, { redirect: 'manual' }); landed = p.status + ' ' + (p.headers.get('location') || ''); j.url = j.url.replace(/[^/]+$/, '<token>'); }
  out.push({ slug, status: r.status, body: j, landed });
}
for (const u of ['https://horizon-br6n.vercel.app/admin','https://horizon-br6n.vercel.app/admin/magic/test123','https://shin-orne.vercel.app/admin/magic/test123','https://atelier-noir-official.vercel.app/admin/magic/test123']) { const r = await fetch(u); out.push({ u, status: r.status, server: r.headers.get('server'), xvc: r.headers.get('x-vercel-error'), body: (await r.text()).slice(0, 200) }); }
fs.writeFileSync(`${OUT}/chat.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
