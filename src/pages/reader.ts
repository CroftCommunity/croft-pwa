// Atmosphere reader: the content-fetch standard, demonstrated. It aggregates real
// RSS/Atom feeds ABOUT the Bluesky/atproto ecosystem — ordinary websites the
// same-origin policy blocks a static page from reading. The page itself never
// fetches cross-origin; it asks the Croft Bridge extension, which holds the
// per-source permission. Without the extension (or before a source is approved)
// the page degrades to a clear call to action rather than failing.
import { mountShell } from '../nav';
import { registerServiceWorker } from '../sw-register';
import { log } from '../log';
import { measure } from '../measure/measure';
import { detectBridge, fetchVia, windowTransport, type BridgeTransport } from '../reader/bridge';
import { parseFeed, type FeedItem } from '../reader/feed-parse';

measure.record('page_reader');

// Default sources — the CORS-blocked ecosystem feeds verified in the plan's D1.
// Ordinary websites, not atproto records (those the AppView already serves
// CORS-free on the atproto page); these are exactly what needs the extension.
interface Source {
  readonly url: string;
  readonly title: string;
}
const DEFAULT_SOURCES: readonly Source[] = [
  { url: 'https://atproto.com/rss.xml', title: 'AT Protocol Blog' },
  { url: 'https://docs.bsky.app/blog/rss.xml', title: 'Bluesky docs blog' },
];

/**
 * The sources to read: any `?src=<feed-url>` query params (repeatable — a shared
 * or added source), else the defaults. Only http(s) URLs are honoured; each still
 * has to be approved in the extension, so this cannot widen what is fetched.
 */
function sources(search: string): readonly Source[] {
  const custom = new URLSearchParams(search)
    .getAll('src')
    .map((url) => url.trim())
    .filter((url) => url.startsWith('https://') || url.startsWith('http://'));
  if (custom.length > 0) return custom.map((url) => ({ url, title: url }));
  return DEFAULT_SOURCES;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function intro(): HTMLElement {
  const panel = el('section', 'panel');
  panel.append(
    el('h1', undefined, 'Atmosphere reader'),
    el(
      'p',
      undefined,
      'A backendless reader for the open web around Bluesky and the AT Protocol. ' +
        'These are ordinary RSS feeds the browser will not let a static page read ' +
        'across origins — so the page asks the Croft Bridge extension, which holds ' +
        'the permission for each source you approve. The page fetches nothing itself.',
    ),
  );
  return panel;
}

/** A single feed item rendered as safe, plain text (no markup from the source). */
function itemNode(source: string, item: FeedItem): HTMLElement {
  const article = el('article', 'reader-item');
  article.setAttribute('data-testid', 'reader-item');

  const heading = el('h2');
  if (item.link !== '') {
    const link = el('a', undefined, item.title);
    link.href = item.link;
    link.rel = 'noopener noreferrer';
    link.target = '_blank';
    heading.append(link);
  } else {
    heading.textContent = item.title;
  }

  const meta = el('p', 'reader-meta');
  meta.append(el('span', 'reader-source', source));
  if (item.published !== '') meta.append(el('span', 'reader-date', item.published));

  article.append(heading, meta);
  if (item.excerpt !== '') article.append(el('p', 'reader-excerpt', item.excerpt));
  return article;
}

function ctaInstall(): HTMLElement {
  const panel = el('section', 'panel');
  panel.setAttribute('data-testid', 'reader-cta-install');
  panel.append(
    el('h2', undefined, 'Install the Croft Bridge extension'),
    el(
      'p',
      undefined,
      'This reader needs the Croft Bridge browser extension to read cross-origin ' +
        'feeds. Load it (unpacked, from the repo’s extension/ folder), then reload ' +
        'this page. See the Content fetch chapter for why an extension and not a proxy.',
    ),
  );
  return panel;
}

function ctaApprove(): HTMLElement {
  const panel = el('section', 'panel');
  panel.setAttribute('data-testid', 'reader-cta-approve');
  panel.append(
    el('h2', undefined, 'Approve the sources'),
    el(
      'p',
      undefined,
      'The Croft Bridge extension is installed, but no source is approved yet. Open ' +
        'the extension’s options and approve a source, then reload — the reader only ' +
        'reads what you have explicitly allowed.',
    ),
  );
  return panel;
}

async function loadFeeds(
  transport: BridgeTransport,
  mount: HTMLElement,
  feeds: readonly Source[],
): Promise<void> {
  const list = el('div', 'reader-list');
  list.setAttribute('data-testid', 'reader-list');
  const status = el('p', 'reader-status');
  status.setAttribute('role', 'status');
  status.textContent = 'Loading feeds…';
  mount.replaceChildren(intro(), status, list);

  let rendered = 0;
  let anyRefused = false;
  for (const source of feeds) {
    const result = await fetchVia(transport, source.url);
    if (result.kind === 'not-installed') {
      mount.replaceChildren(intro(), ctaInstall());
      return;
    }
    if (result.kind === 'not-approved') {
      anyRefused = true;
      continue;
    }
    if (result.kind === 'error') {
      log.warn('reader: source failed', source.url, result.message);
      continue;
    }
    const parsed = parseFeed(result.body);
    if (!parsed.ok) {
      log.warn('reader: parse failed', source.url, parsed.error);
      continue;
    }
    for (const item of parsed.items) {
      list.append(itemNode(parsed.source || source.title, item));
      rendered += 1;
    }
  }

  if (rendered === 0) {
    mount.replaceChildren(intro(), anyRefused ? ctaApprove() : ctaInstall());
    return;
  }
  status.textContent = `${rendered} item${rendered === 1 ? '' : 's'} from ${feeds.length} sources.`;
}

const app = document.getElementById('app');
if (!app) throw new Error('reader: #app not found');

const mount = el('div');
mountShell(app, mount);
registerServiceWorker();
log.info('shell mounted', 'reader');

const transport = windowTransport(window);
const feeds = sources(window.location.search);
void detectBridge(transport).then((present) => {
  if (!present) {
    mount.replaceChildren(intro(), ctaInstall());
    return;
  }
  void loadFeeds(transport, mount, feeds);
});
