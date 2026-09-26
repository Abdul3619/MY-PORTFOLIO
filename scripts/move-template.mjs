// Moves the built HTML template out of the static client output so pages are only ever served through the
// server renderer. If any HTML file were left in the static output, the host could serve it directly
// (e.g. an index.html for "/"), returning an empty shell instead of the server-rendered page.
import fs from 'fs';
import path from 'path';

const clientDir = path.resolve('dist/client');
const from = path.join(clientDir, 'app.html');
const to = path.resolve('dist/server/template.html');

if (!fs.existsSync(from)) {
  console.error(`move-template: ${from} not found. Run the client build first.`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(to), { recursive: true });
fs.renameSync(from, to);
console.log('move-template: dist/client/app.html -> dist/server/template.html');

// Guard: no HTML may remain anywhere in the static output
const leftovers = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) leftovers.push(path.relative(process.cwd(), full));
  }
};
walk(clientDir);
if (leftovers.length > 0) {
  console.error(`move-template: HTML files would be served statically and bypass SSR: ${leftovers.join(', ')}`);
  process.exit(1);
}
