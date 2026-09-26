// Regression check: starts the production server from the current build (run `npm run build` first) and
// verifies that pages are really server-rendered. It fails if a page comes back as the empty client-side
// shell, which is what happens when the server render throws and falls back (the page still returns 200,
// so a successful build alone proves nothing).
//
// By default the server talks to a tiny in-process stand-in for Supabase that serves a fixed profile, so the
// check is deterministic and needs no secrets, while still exercising the data-driven parts of the page
// (title, name, role). Set SSR_CHECK_USE_REAL_DATA=1 to use the Supabase settings from the environment.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import http from 'node:http';

const PORT = process.env.SSR_CHECK_PORT || '3099';
const BASE = `http://127.0.0.1:${PORT}`;
const GENERIC_TITLE = 'My Portfolio';
const MIN_ROOT_HTML = 2000; // an empty shell has ~0 characters inside #root

const FIXTURE_PROFILE = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Abdul Wahab',
  title: 'Web Developer & Solar Technician',
  bio: JSON.stringify({
    bio_text: 'SSR check fixture bio.',
    // A secret that must never reach public pages or /api/seo
    seo_settings: { plausible_api_key: 'ssr-check-secret-key' },
  }),
};
const SITE_TITLE = 'Abdul Wahab | Web Developer &amp; Solar Technician';
const SECRET = 'ssr-check-secret-key';

const PAGES = [
  { path: '/', title: SITE_TITLE, mustContain: ['Abdul Wahab', 'Web Developer', 'Completed Projects', '<meta property="og:title"', '<meta property="og:description"', '<link rel="canonical"', 'application/ld+json'] },
  { path: '/about', title: `About | ${SITE_TITLE}`, mustContain: ['Abdul Wahab', 'Web Developer', '<meta name="description"', '<meta property="og:url"'] },
];

// Minimal PostgREST stand-in: the profiles table holds the fixture, every other table is empty
function startMockSupabase() {
  const mock = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      const table = (new URL(req.url, 'http://x').pathname.match(/^\/rest\/v1\/(\w+)/) || [])[1];
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 201;
        return res.end(body || '[]');
      }
      const rows = table === 'profiles' ? [FIXTURE_PROFILE] : [];
      if ((req.headers.accept || '').includes('vnd.pgrst.object')) {
        if (rows.length !== 1) {
          res.statusCode = 406;
          return res.end(JSON.stringify({ code: 'PGRST116', message: 'no rows' }));
        }
        return res.end(JSON.stringify(rows[0]));
      }
      res.end(JSON.stringify(rows));
    });
  });
  return new Promise((resolve) => mock.listen(0, '127.0.0.1', () => resolve(mock)));
}

if (!existsSync('dist/server.cjs') || !existsSync('dist/server/entry-server.js')) {
  console.error('check-ssr: build output not found. Run `npm run build` first.');
  process.exit(1);
}

const useRealData = !!process.env.SSR_CHECK_USE_REAL_DATA;
const mock = useRealData ? null : await startMockSupabase();

const env = { ...process.env, NODE_ENV: 'production', PORT };
delete env.VERCEL; // on Vercel builds VERCEL=1 would stop the server from listening
if (mock) {
  env.VITE_SUPABASE_URL = `http://127.0.0.1:${mock.address().port}`;
  env.VITE_SUPABASE_ANON_KEY = 'ssr-check';
  env.SUPABASE_SERVICE_ROLE_KEY = 'ssr-check';
}

let serverLog = '';
const server = spawn(process.execPath, ['dist/server.cjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

const failures = [];
const fail = (msg) => failures.push(msg);

// Readiness is a plain TCP connect: rendering a page can take several seconds when data sources time out
function portOpen() {
  return new Promise((resolve) => {
    const socket = net.connect(Number(PORT), '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error(`server exited early with code ${server.exitCode}`);
    if (await portOpen()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not start within 30s');
}

try {
  await waitForServer();
  for (const page of PAGES) {
    const res = await fetch(`${BASE}${page.path}`, { signal: AbortSignal.timeout(30000) });
    const html = await res.text();
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1]?.trim() ?? '';
    const rootStart = html.indexOf('<div id="root">');
    const rootHtml = rootStart === -1 ? '' : html.slice(rootStart + '<div id="root">'.length);
    const rootLength = rootHtml.split('<script')[0].length;

    if (res.status !== 200) fail(`${page.path}: HTTP ${res.status}`);
    if (!title || title === GENERIC_TITLE) fail(`${page.path}: generic or missing <title> ("${title}")`);
    else if (mock && title !== page.title) fail(`${page.path}: <title> is "${title}", expected "${page.title}"`);
    if (html.includes(SECRET)) fail(`${page.path}: a secret setting (plausible_api_key) is exposed in the page HTML`);
    if (page.path === '/') {
      const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      try {
        const graph = JSON.parse(ld?.[1] ?? 'null')?.['@graph'] ?? [];
        if (!graph.some((node) => node['@type'] === 'Person' && node.name === 'Abdul Wahab')) fail('/: JSON-LD has no Person named Abdul Wahab');
      } catch {
        fail('/: JSON-LD is missing or is not valid JSON');
      }
    }
    if (rootLength < MIN_ROOT_HTML) fail(`${page.path}: #root is empty or nearly empty (${rootLength} chars) - server render fell back to the client shell`);
    for (const text of page.mustContain) {
      if (!html.includes(text)) fail(`${page.path}: expected text "${text}" not found in server HTML`);
    }
    console.log(`check-ssr: ${page.path} -> ${res.status}, title "${title}", ${rootLength} chars rendered`);
  }
  const sitemap = await fetch(`${BASE}/sitemap.xml`, { signal: AbortSignal.timeout(30000) });
  const sitemapXml = await sitemap.text();
  if (sitemap.status !== 200 || !sitemapXml.includes('<urlset') || !sitemapXml.includes('/about</loc>')) {
    fail(`/sitemap.xml: expected 200 with a <urlset> listing /about (got ${sitemap.status})`);
  }
  const robots = await fetch(`${BASE}/robots.txt`, { signal: AbortSignal.timeout(30000) });
  const robotsTxt = await robots.text();
  if (robots.status !== 200 || !/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m.test(robotsTxt)) fail(`/robots.txt: expected 200 with a Sitemap line (got ${robots.status})`);
  const seoApi = await (await fetch(`${BASE}/api/seo`, { signal: AbortSignal.timeout(30000) })).text();
  if (seoApi.includes(SECRET)) fail('/api/seo: the public response exposes plausible_api_key');
  console.log(`check-ssr: /sitemap.xml -> ${sitemap.status} (${(sitemapXml.match(/<url>/g) || []).length} URLs), /robots.txt -> ${robots.status}`);

  if (serverLog.includes('[SSR] Render failed')) {
    fail('server logged "[SSR] Render failed":\n' + serverLog.split('\n').filter((l) => l.includes('Render failed') || l.includes('Error')).slice(0, 5).join('\n'));
  }
} catch (err) {
  fail(`${err.message}\n--- server output ---\n${serverLog.slice(-3000)}`);
} finally {
  server.kill();
  mock?.close();
}

if (failures.length) {
  console.error('\ncheck-ssr FAILED:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('check-ssr: all pages server-rendered correctly');
