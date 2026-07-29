// Extension e2e tier entry point (`npm run e2e:ext`). Runs each scenario against
// real Chromium with the real unpacked extension; exits non-zero on any failure.
// Node-driven for reliability (see harness.mjs header). Scenarios are added here
// as later phases land (Phase 4 consent, Phase 7 reader).
import { join } from 'node:path';
import { startOrigins, launchExtension, check, summarise, REPO } from './harness.mjs';

const MIN_EXT = join(REPO, 'tests', 'ext', 'fixtures', 'min-ext');
const CROFT_BRIDGE = join(REPO, 'extension');

const FEED =
  '<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>' +
  '<item><title>hello-bridge</title><link>https://e.com/a</link><description>d</description></item>' +
  '</channel></rss>';

async function gotoTestPage(page, url) {
  await page.goto(url, { waitUntil: 'commit', timeout: 15_000 });
  await page.waitForFunction(() => typeof window.__directFetch === 'function', { timeout: 15_000 });
}

// --- Scenario 1: the harness loads an extension and sees its SW register ----
{
  const { extensionId, close } = await launchExtension(MIN_EXT);
  check('harness: extension loads and its service worker registers', /^[a-p]{32}$/.test(extensionId), extensionId);
  await close();
}

// --- Scenario 2: the harness serves the test page on the PWA origin ---------
{
  const { context, close } = await launchExtension(MIN_EXT);
  const origins = await startOrigins('<rss></rss>');
  try {
    const page = await context.newPage();
    await gotoTestPage(page, origins.pwaUrl);
    const marker = await page.textContent('#marker');
    check('harness: serves the test page', marker === 'croft-ext-test-page', `marker=${marker}`);
    const hasProbes = await page.evaluate(
      () => typeof window.__directFetch === 'function' && typeof window.__viaExtension === 'function',
    );
    check('harness: test page exposes the probes', hasProbes);
  } finally {
    await origins.stop();
    await close();
  }
}

// --- Scenario 3 (Phase 3 bridge): page can't fetch a no-CORS origin, ext can -
{
  const { context, close } = await launchExtension(CROFT_BRIDGE);
  const origins = await startOrigins(FEED);
  try {
    const page = await context.newPage();
    await gotoTestPage(page, origins.pwaUrl);
    await page.waitForFunction(() => window.__extReady(), { timeout: 15_000 }).catch(() => undefined);

    const direct = await page.evaluate((u) => window.__directFetch(u), origins.readerUrl);
    check('bridge: direct page fetch of a no-CORS origin is blocked', direct.ok === false, direct.error);

    const via = await page.evaluate((u) => window.__viaExtension(u), origins.readerUrl);
    const delivered = via.ok === true && typeof via.body === 'string' && via.body.includes('hello-bridge');
    check('bridge: the extension delivers the cross-origin content', delivered, via.ok ? `status ${via.status}` : via.error);
  } finally {
    await origins.stop();
    await close();
  }
}

// --- Scenario 4 (Phase 4 consent): the gate is browser permissions, not a list -
// A feed origin the user has NOT granted is refused by the extension (before any
// network call), while the dev-permitted localhost origin is allowed. The real
// grant flow (chrome.permissions.request) is a native prompt that cannot be
// driven headless (Phase 0 D2) — it is validated manually; here we prove the
// refusal branch and that a permitted origin passes the same gate.
{
  const { context, close } = await launchExtension(CROFT_BRIDGE);
  const origins = await startOrigins(FEED);
  try {
    const page = await context.newPage();
    await gotoTestPage(page, origins.pwaUrl);
    await page.waitForFunction(() => window.__extReady(), { timeout: 15_000 }).catch(() => undefined);

    // Ungranted feed origin → refused by the permission gate, not fetched.
    const feed = await page.evaluate((u) => window.__viaExtension(u), 'https://atproto.com/rss.xml');
    check(
      'consent: an ungranted feed origin is refused by the permission gate',
      feed.ok === false && feed.refused === true,
      feed.error,
    );

    // Permitted origin (localhost is in static host_permissions for dev) → allowed.
    const allowed = await page.evaluate((u) => window.__viaExtension(u), origins.readerUrl);
    check('consent: a permitted origin passes the same gate', allowed.ok === true, allowed.ok ? `status ${allowed.status}` : allowed.error);

    // A non-permitted local host (same server, different hostname) → refused.
    const other = await page.evaluate((u) => window.__viaExtension(u), origins.readerUrl127);
    check('consent: a non-permitted host is refused', other.ok === false && other.refused === true, other.error);
  } finally {
    await origins.stop();
    await close();
  }
}

process.exit(summarise('extension e2e'));
