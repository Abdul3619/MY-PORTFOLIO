// Moves the built index.html out of the static client output so it is only ever served through the
// server renderer (otherwise static hosting would serve the empty shell for "/").
import fs from 'fs';
import path from 'path';

const from = path.resolve('dist/client/index.html');
const to = path.resolve('dist/server/template.html');

if (!fs.existsSync(from)) {
  console.error(`move-template: ${from} not found. Run the client build first.`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(to), { recursive: true });
fs.renameSync(from, to);
console.log('move-template: dist/client/index.html -> dist/server/template.html');
