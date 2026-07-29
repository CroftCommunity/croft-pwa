// Harness for the extension e2e tier (`npm run e2e:ext`, a separate config, NOT
// in the default `npm test` gate). Ports the discovery spike's proven setup into
// the repo: load an unpacked MV3 extension in a persistent Chromium context, and
// serve two local origins — a PWA origin (origin A, the test page) and a reader
// origin (origin B) that deliberately sends NO Access-Control-Allow-Origin, so a
// page fetch of B is genuinely CORS-blocked and only the extension can read it.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const PAGE_DIR = join(here, 'fixtures', 'page');

const CTYPE: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.xml': 'application/rss+xml; charset=utf-8',
};

/** Two running local origins for an extension test, plus a teardown. */
export interface Origins {
  /** Origin A — serves the static test page (`fixtures/page/`). */
  readonly pwaUrl: string;
  /** Origin B — serves `readerBody` with no ACAO header. */
  readonly readerUrl: string;
  /** The bare origin of B (scheme+host+port), for allowlist assertions. */
  readonly readerOrigin: string;
  readonly stop: () => Promise<void>;
}

function portOf(server: http.Server): number {
  const addr = server.address();
  if (addr === null || typeof addr === 'string') {
    throw new Error('server has no numeric address');
  }
  return addr.port;
}

/**
 * Start origin A (the test page) and origin B (a no-CORS reader serving
 * `readerBody`). Both bind ephemeral ports, so tests never collide on a fixed
 * port (the discovery spike's `:4173` gotcha).
 */
export async function startOrigins(
  readerBody: string,
  readerContentType = 'application/rss+xml; charset=utf-8',
): Promise<Origins> {
  const pwa = http.createServer((req, res) => {
    const path = req.url === '/' || req.url === undefined ? '/index.html' : req.url;
    const rel = path.split('?')[0] ?? '/index.html';
    try {
      const body = readFileSync(join(PAGE_DIR, rel));
      res.setHeader('Content-Type', CTYPE[extname(rel)] ?? 'application/octet-stream');
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end('not found');
    }
  });
  const reader = http.createServer((_req, res) => {
    // Deliberately NO Access-Control-Allow-Origin — this is what makes a page
    // fetch of B fail and the extension necessary.
    res.setHeader('Content-Type', readerContentType);
    res.end(readerBody);
  });

  await new Promise<void>((resolve) => pwa.listen(0, '127.0.0.1', resolve));
  await new Promise<void>((resolve) => reader.listen(0, '127.0.0.1', resolve));

  const pwaUrl = `http://localhost:${portOf(pwa)}/`;
  const readerOrigin = `http://localhost:${portOf(reader)}`;

  return {
    pwaUrl,
    readerUrl: `${readerOrigin}/feed.xml`,
    readerOrigin,
    stop: () =>
      Promise.all([
        new Promise<void>((resolve) => pwa.close(() => resolve())),
        new Promise<void>((resolve) => reader.close(() => resolve())),
      ]).then(() => undefined),
  };
}

interface ExtensionFixtures {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly extensionId: string;
}

/**
 * A Playwright `test` bound to a specific unpacked extension. Each test gets a
 * persistent Chromium context with the extension loaded, its first page, and the
 * extension id resolved from the background service worker.
 */
export function extensionTest(extensionPath: string): ReturnType<typeof base.extend<ExtensionFixtures>> {
  return base.extend<ExtensionFixtures>({
    // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature
    context: async ({}, use) => {
      const context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
      });
      await use(context);
      await context.close();
    },
    page: async ({ context }, use) => {
      const [existing] = context.pages();
      const page = existing ?? (await context.newPage());
      await use(page);
    },
    extensionId: async ({ context }, use) => {
      const [existing] = context.serviceWorkers();
      const worker = existing ?? (await context.waitForEvent('serviceworker', { timeout: 10_000 }));
      const id = new URL(worker.url()).host;
      await use(id);
    },
  });
}
