// Regression check (run `npm run build` first). Verifies that pages are really server-rendered and that
// /robots.txt and /sitemap.xml work, against two targets:
//
//   1. node   - the bundled server (dist/server.cjs), as `npm start` runs it.
//   2. vercel - the Vercel function, compiled the way Vercel compiles it: api/index.ts and every local file
//               it imports are transpiled one by one to ES modules with their import paths left exactly as
//               written, then loaded by Node. This catches failures that only exist in the deployed
//               function, such as a relative import without a file extension (ERR_MODULE_NOT_FOUND, which
//               made every production route return 500 even though target 1 passed).
//
// It fails if a page comes back as the empty client-side shell (the server render threw and fell back; the
// response is still a 200, so a green build alone proves nothing), if a route errors, or if a secret
// setting leaks into public output.
//
// By default the server talks to a tiny in-process stand-in for Supabase that serves a fixed profile, so the
// check is deterministic and needs no secrets, while still exercising the data-driven parts of the page
// (title, name, role). Set SSR_CHECK_USE_REAL_DATA=1 to use the Supabase settings from the environment.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { transformSync } from 'esbuild';

const GENERIC_TITLE = 'My Portfolio';
const MIN_ROOT_HTML = 2000; // an empty shell has ~0 characters inside #root
const ROOT = process.cwd();
const FUNCTION_ENTRY = 'api/index.ts';
const FUNCTION_OUT_DIR = path.join(ROOT, '.ssr-check-function');

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
  { path: '/', title: SITE_TITLE, mustContain: ['Abdul Wahab', 'Web Developer', 'Business websites', '<meta property="og:title"', '<meta property="og:description"', '<link rel="canonical"', 'application/ld+json'] },
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

// --- Vercel-style function build -------------------------------------------------------------------------

const LOCAL_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]+)\1/g;

// Finds the source file for a relative import the way TypeScript does (".js" may refer to a ".ts" file,
// extension-less paths to ".ts"/".tsx"/index files).
function resolveSource(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = /\.(m?js|cjs)$/.test(base)
    ? [base.replace(/\.(m?js|cjs)$/, '.ts'), base.replace(/\.(m?js|cjs)$/, '.tsx'), base]
    : [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')];
  return candidates.find((c) => existsSync(c) && !c.endsWith(path.sep));
}

// Transpiles the function entry and every local file it imports, one file at a time, keeping each import
// specifier unchanged (as Vercel does). Output mirrors the source tree under FUNCTION_OUT_DIR.
function buildFunctionLikeVercel() {
  rmSync(FUNCTION_OUT_DIR, { recursive: true, force: true });
  const queue = [path.join(ROOT, FUNCTION_ENTRY)];
  const done = new Set();
  while (queue.length) {
    const file = queue.pop();
    if (done.has(file)) continue;
    done.add(file);
    const source = readFileSync(file, 'utf8');
    const isTs = /\.tsx?$/.test(file);
    const code = isTs
      ? transformSync(source, { loader: file.endsWith('.tsx') ? 'tsx' : 'ts', format: 'esm', target: 'node22', jsx: 'automatic' }).code
      : source;
    const outFile = path.join(FUNCTION_OUT_DIR, path.relative(ROOT, file)).replace(/\.tsx?$/, '.js');
    mkdirSync(path.dirname(outFile), { recursive: true });
    writeFileSync(outFile, code);
    for (const match of code.matchAll(LOCAL_IMPORT)) {
      const resolved = resolveSource(file, match[2]);
      if (resolved) queue.push(resolved);
    }
  }
  // Same module type as the project, so Node loads the output as ES modules just like on Vercel
  writeFileSync(path.join(FUNCTION_OUT_DIR, 'package.json'), JSON.stringify({ type: 'module' }));
  return path.join(FUNCTION_OUT_DIR, FUNCTION_ENTRY.replace(/\.tsx?$/, '.js'));
}

// --- Target runner -----------------------------------------------------------------------------------------

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect(Number(port), '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

async function checkTarget({ name, port, command, args, env }, failures) {
  const fail = (msg) => failures.push(`[${name}] ${msg}`);
  const base = `http://127.0.0.1:${port}`;
  let log = '';
  const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));

  try {
    // Readiness is a plain TCP connect: rendering a page can take several seconds when data sources time out
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
      ready = await portOpen(port);
      if (!ready) await new Promise((r) => setTimeout(r, 500));
    }
    if (!ready) throw new Error('server did not start within 30s');

    for (const page of PAGES) {
      const res = await fetch(`${base}${page.path}`, { signal: AbortSignal.timeout(30000) });
      const html = await res.text();
      const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1]?.trim() ?? '';
      const rootStart = html.indexOf('<div id="root">');
      const rootLength = rootStart === -1 ? 0 : html.slice(rootStart + '<div id="root">'.length).split('<script')[0].length;

      if (res.status !== 200) fail(`${page.path}: HTTP ${res.status}`);
      if (!title || title === GENERIC_TITLE) fail(`${page.path}: generic or missing <title> ("${title}")`);
      else if (env.SSR_CHECK_MOCK && title !== page.title) fail(`${page.path}: <title> is "${title}", expected "${page.title}"`);
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
      console.log(`check-ssr [${name}]: ${page.path} -> ${res.status}, title "${title}", ${rootLength} chars rendered`);
    }

    const robots = await fetch(`${base}/robots.txt`, { signal: AbortSignal.timeout(30000) });
    const robotsTxt = await robots.text();
    if (robots.status !== 200) fail(`/robots.txt: HTTP ${robots.status}`);
    if (!(robots.headers.get('content-type') || '').startsWith('text/plain')) fail(`/robots.txt: content-type is "${robots.headers.get('content-type')}", expected text/plain`);
    if (!/^User-agent: \*$/m.test(robotsTxt) || !/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m.test(robotsTxt)) fail('/robots.txt: missing "User-agent: *" or an absolute "Sitemap:" line');

    const sitemap = await fetch(`${base}/sitemap.xml`, { signal: AbortSignal.timeout(30000) });
    const sitemapXml = await sitemap.text();
    const urlCount = (sitemapXml.match(/<url>/g) || []).length;
    if (sitemap.status !== 200) fail(`/sitemap.xml: HTTP ${sitemap.status}`);
    if (!(sitemap.headers.get('content-type') || '').includes('xml')) fail(`/sitemap.xml: content-type is "${sitemap.headers.get('content-type')}", expected XML`);
    if (!sitemapXml.startsWith('<?xml') || !sitemapXml.includes('<urlset') || !sitemapXml.includes('/about</loc>') || urlCount < PAGES.length) {
      fail(`/sitemap.xml: expected an XML <urlset> listing the site's pages (got ${urlCount} URLs)`);
    }
    const robotsSitemap = (robotsTxt.match(/^Sitemap: (\S+)$/m) || [])[1];
    const firstLoc = (sitemapXml.match(/<loc>([^<]+)<\/loc>/) || [])[1];
    if (robotsSitemap && firstLoc && new URL(robotsSitemap).origin !== new URL(firstLoc).origin) {
      fail(`/robots.txt points to ${robotsSitemap} but the sitemap lists ${new URL(firstLoc).origin}`);
    }
    console.log(`check-ssr [${name}]: /robots.txt -> ${robots.status}, /sitemap.xml -> ${sitemap.status} (${urlCount} URLs)`);

    const seoApi = await (await fetch(`${base}/api/seo`, { signal: AbortSignal.timeout(30000) })).text();
    if (seoApi.includes(SECRET)) fail('/api/seo: the public response exposes plausible_api_key');

    if (log.includes('[SSR] Render failed')) {
      fail('server logged "[SSR] Render failed":\n' + log.split('\n').filter((l) => l.includes('Render failed') || l.includes('Error')).slice(0, 5).join('\n'));
    }
  } catch (err) {
    fail(`${err.message}\n--- server output ---\n${log.slice(-3000)}`);
  } finally {
    child.kill();
  }
}

// --- Main --------------------------------------------------------------------------------------------------

if (!existsSync('dist/server.cjs') || !existsSync('dist/server/entry-server.js') || !existsSync('dist/server/template.html')) {
  console.error('check-ssr: build output not found. Run `npm run build` first.');
  process.exit(1);
}

const mock = process.env.SSR_CHECK_USE_REAL_DATA ? null : await startMockSupabase();
const baseEnv = { ...process.env, NODE_ENV: 'production' };
delete baseEnv.VERCEL;
if (mock) {
  Object.assign(baseEnv, {
    SSR_CHECK_MOCK: '1',
    VITE_SUPABASE_URL: `http://127.0.0.1:${mock.address().port}`,
    VITE_SUPABASE_ANON_KEY: 'ssr-check',
    SUPABASE_SERVICE_ROLE_KEY: 'ssr-check',
  });
}

const failures = [];
try {
  // 1. The bundled Node server (on Vercel builds VERCEL=1 would stop it from listening, so it is unset)
  const nodePort = process.env.SSR_CHECK_PORT || '3099';
  await checkTarget({ name: 'node', port: nodePort, command: process.execPath, args: ['dist/server.cjs'], env: { ...baseEnv, PORT: nodePort } }, failures);

  // 2. The Vercel function, compiled per file and loaded as ES modules with VERCEL=1 (no app.listen);
  //    a tiny host serves its default export, as Vercel's runtime does.
  let entry = null;
  try {
    entry = buildFunctionLikeVercel();
  } catch (err) {
    failures.push(`[vercel] could not compile the function: ${err.message}`);
  }
  if (entry) {
    const fnPort = String(Number(nodePort) + 1);
    const host = `import http from 'node:http';
      import(${JSON.stringify(entry)})
        .then((m) => http.createServer(m.default).listen(${fnPort}, '127.0.0.1'))
        .catch((e) => { console.error('Function failed to load:', e.code || '', e.message); process.exit(1); });`;
    await checkTarget({ name: 'vercel', port: fnPort, command: process.execPath, args: ['--input-type=module', '-e', host], env: { ...baseEnv, VERCEL: '1' } }, failures);
  }
} finally {
  mock?.close();
  rmSync(FUNCTION_OUT_DIR, { recursive: true, force: true });
}

if (failures.length) {
  console.error('\ncheck-ssr FAILED:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('check-ssr: all pages, /robots.txt and /sitemap.xml work in both the Node server and the Vercel function');
