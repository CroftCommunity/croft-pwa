// Regenerate the user-guide screenshots from the *built* app, so the guide can
// never show a UI that no longer exists. Rerun after any visual change:
//
//   npm run build && npm run guide:shots
//
// It serves dist/ with the repo's own static server, drives real Chrome, and
// writes assets/guide/<name>.jpg. The guide references these by name; a unit
// test fails if a referenced shot is missing.
import { existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
const outDir = join(root, 'assets', 'guide');
const PORT = 4188;

// Each shot: the destination, the theme to force, and the output name the guide
// references (see src/pages/guide-content.ts `shot` blocks).
const SHOTS = [
  { name: 'home-light', path: '/index.html', theme: 'light' },
  { name: 'home-dark', path: '/index.html', theme: 'dark' },
];

if (!existsSync(join(dist, 'index.html'))) {
  console.error('guide-shots: dist/ not found — run `npm run build` first.');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const server = spawn('node', [join(root, 'tools', 'serve.mjs'), dist, String(PORT)], {
  stdio: 'ignore',
});
// Give the server a moment to bind. (No Date.now() dependence — a fixed wait.)
await new Promise((r) => setTimeout(r, 600));

const browser = await chromium.launch();
try {
  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: 400, height: 760 },
      deviceScaleFactor: 2,
    });
    await context.addInitScript((theme) => {
      try {
        // Runs in the browser page context, not node.
        // eslint-disable-next-line no-undef
        localStorage.setItem('croft-theme', theme);
      } catch {
        /* ignore */
      }
    }, shot.theme);
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}${shot.path}`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: join(outDir, `${shot.name}.jpg`),
      type: 'jpeg',
      quality: 82,
      fullPage: true,
    });
    await context.close();
    console.log(`guide-shots: wrote assets/guide/${shot.name}.jpg`);
  }
} finally {
  await browser.close();
  server.kill();
}
