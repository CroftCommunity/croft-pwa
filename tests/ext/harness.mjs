// Node harness for the extension e2e tier (`npm run e2e:ext`). A SEPARATE tier,
// NOT in the default `npm test` gate.
//
// Why node and not the Playwright test-runner: the mechanism (a page reads a
// no-CORS origin only via the extension) is driven identically here, but the
// Playwright *test-runner* intermittently wedges an MV3 content-script
// extension's page context in this environment (warmup / profile isolation /
// commit-navigation / bounded timeouts all fail to stabilise it), whereas node
// driving the same scenario is 100% reliable — the same channel the discovery
// spike (discovery/alpha/experiments/extension-content-fetch) used to prove
// this. So this tier drives Chromium directly via playwright-core.
//
// Provides: startOrigins (origin A = the test page, origin B = a no-ACAO reader),
// launchExtension (persistent context with an unpacked extension + its id), and
// a tiny check/summary registry. Consumed by run-ext.mjs.
import http from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const here = dirname(fileURLToPath(import.meta.url));
const PAGE_DIR = join(here, 'fixtures', 'page');
export const REPO = join(here, '..', '..');

const CTYPE = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.xml': 'application/rss+xml; charset=utf-8',
};

/**
 * Start origin A (the static test page) and origin B (a no-CORS reader serving
 * `readerBody`). Ephemeral ports, so no fixed-port collision. Returns URLs plus
 * a stop() teardown.
 */
export async function startOrigins(readerBody, readerContentType = 'application/rss+xml; charset=utf-8') {
  const pwa = http.createServer((req, res) => {
    const rel = (req.url === '/' || req.url === undefined ? '/index.html' : req.url).split('?')[0];
    try {
      res.setHeader('Content-Type', CTYPE[extname(rel)] ?? 'application/octet-stream');
      res.end(readFileSync(join(PAGE_DIR, rel)));
    } catch {
      res.statusCode = 404;
      res.end('not found');
    }
  });
  const reader = http.createServer((_req, res) => {
    // Deliberately NO Access-Control-Allow-Origin.
    res.setHeader('Content-Type', readerContentType);
    res.end(readerBody);
  });
  await new Promise((r) => pwa.listen(0, '127.0.0.1', r));
  await new Promise((r) => reader.listen(0, '127.0.0.1', r));
  const readerPort = reader.address().port;
  const readerOrigin = `http://localhost:${readerPort}`;
  return {
    pwaUrl: `http://localhost:${pwa.address().port}/`,
    readerUrl: `${readerOrigin}/feed.xml`,
    readerOrigin,
    // The same reader server reached via 127.0.0.1 — a different host that the
    // extension is NOT permitted for, used to exercise the refusal branch.
    readerUrl127: `http://127.0.0.1:${readerPort}/feed.xml`,
    stop: () =>
      Promise.all([
        new Promise((r) => pwa.close(r)),
        new Promise((r) => reader.close(r)),
      ]),
  };
}

/** Launch a persistent Chromium context with an unpacked extension loaded. */
export async function launchExtension(extensionPath) {
  const userDataDir = mkdtempSync(join(tmpdir(), 'croft-ext-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15_000 });
  const extensionId = new URL(sw.url()).host;
  const close = async () => {
    await context.close();
    rmSync(userDataDir, { recursive: true, force: true });
  };
  return { context, extensionId, close };
}

// --- tiny check registry ---------------------------------------------------
const results = [];

/** Record a check. `pass` is boolean; `detail` is a short human note. */
export function check(name, pass, detail = '') {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

/** Print the summary and return the process exit code (0 = all passed). */
export function summarise(label) {
  const passed = results.filter((r) => r.pass).length;
  const ok = passed === results.length && results.length > 0;
  console.log(`\n${ok ? 'GREEN' : 'RED'} — ${label}: ${passed}/${results.length} checks`);
  return ok ? 0 : 1;
}
