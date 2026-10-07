// Packages the Chromium binary that @sparticuz/chromium (the full, devDependency package) just installed
// into public/chromium-pack.tar, so it gets deployed as an ordinary static asset and served from this same
// site. outreach/screenshot.ts then has @sparticuz/chromium-min (the small, production dependency) download
// and extract it from our own domain at runtime, rather than from someone else's GitHub release URL that
// could go stale or disappear. Rebuilding the tar from node_modules on every install, instead of hardcoding
// a URL, keeps the pack always in sync with whichever chromium version is actually installed.
//
// Adapted from the official "Puppeteer on Vercel" template (github.com/gabenunez/puppeteer-on-vercel),
// whose approach this follows closely because it's the confirmed, working pattern for running headless
// Chromium inside a Vercel serverless function without blowing the 250MB function bundle limit.
//
// Never fails the install: if @sparticuz/chromium isn't present (e.g. a production-only `npm ci --omit=dev`
// elsewhere) or its bin directory is missing for any reason, this just logs and exits cleanly -- the visual
// audit feature degrades to "unavailable" rather than breaking every other install/build step.

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(__dirname);

async function main() {
  try {
    console.log('[postinstall-chromium] Looking for @sparticuz/chromium...');
    const chromiumResolvedPath = import.meta.resolve('@sparticuz/chromium');
    const chromiumPath = chromiumResolvedPath.replace(/^file:\/\//, '');
    // Walk up from .../node_modules/@sparticuz/chromium/build/esm/index.js (or similar) to the package root.
    const chromiumDir = dirname(dirname(dirname(chromiumPath)));
    const binDir = join(chromiumDir, 'bin');

    if (!existsSync(binDir)) {
      console.log('[postinstall-chromium] No bin/ directory found -- skipping. The visual audit feature will stay disabled.');
      return;
    }

    const publicDir = join(projectRoot, 'public');
    const outputPath = join(publicDir, 'chromium-pack.tar');
    console.log(`[postinstall-chromium] Packing ${binDir} -> ${outputPath}`);
    execSync(`mkdir -p "${publicDir}" && tar -cf "${outputPath}" -C "${binDir}" .`, { stdio: 'inherit', cwd: projectRoot });
    console.log('[postinstall-chromium] Done.');
  } catch (error) {
    console.warn('[postinstall-chromium] Skipped (not critical):', error?.message || error);
    process.exit(0); // Never fail the install over this.
  }
}

main();
