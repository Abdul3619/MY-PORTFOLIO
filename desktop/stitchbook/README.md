# StitchBook Desktop

A real, installable desktop build of StitchBook -- the shared order/inventory/catalog
dashboard for the Atelier Noir / AtelierFit family (see `../../src/pages/StitchBook`).

## What this actually is, honestly

This is a thin [Tauri](https://tauri.app) shell: a native window (not a browser tab, no
address bar/tabs chrome) that loads the real, already-deployed StitchBook page
(`https://abdulwahab-portfolio-tau.vercel.app/stitchbook`) straight from the live site.
There is no separately-bundled copy of the web app's code in here -- the desktop app and
the browser version are always the exact same page, so a fix shipped to the website is
already live in the desktop app too, with nothing to re-release.

The "Manage" tab (real AtelierFit order management, see the main app's StitchBook page)
needs the real owner's sign-in the same way it does in a browser -- this app doesn't add
or bypass auth, it's the same Supabase session either way, just remembered by this
window's own storage instead of a browser's.

**Why this exists as a desktop app at all, not just a bookmarked tab:** a real taskbar/dock
icon, its own window separate from a browser's tabs, and (once auto-update is wired up, see
below) can live in a dock without "it's actually just a website" being the first thing
anyone notices.

**What this round did NOT build, stated plainly rather than left implicit:** this sandbox
has no Rust/Cargo toolchain and this session's npm registry access is blocked, so nothing
here has been locally built, run, or tested end-to-end. The config is written to Tauri's
documented schema (`tauri.conf.json` v2, `Cargo.toml`) by hand, not verified against a real
`cargo build`. The real build-and-test happens in CI (see below), which runs on GitHub's own
machines with a clean toolchain -- the first real signal on whether this actually compiles
is that workflow's own run, not anything claimed here.

## Building real installers (CI, not local)

`.github/workflows/stitchbook-desktop.yml` (repo root) builds this with
[`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action) on Windows, macOS
and Linux runners and attaches the real `.msi`/`.dmg`/`.AppImage` installers it produces to
a GitHub Release, whenever a tag matching `stitchbook-v*` is pushed (or via "Run workflow"
in the Actions tab for a manual build without a tag). Download the finished installers from
this repo's **Releases** page once that workflow run finishes.

## Local development (once you have the toolchain)

Needs Node.js, Rust, and Tauri's own OS-level prerequisites
(https://tauri.app/start/prerequisites/) -- none of which exist in the sandbox this was
written in.

```bash
cd desktop/stitchbook
npm install
npm run tauri dev    # opens the dev window
npm run tauri build  # produces a real local installer for your own OS
```
