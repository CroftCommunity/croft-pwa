// Pure feed parser: turn RSS 2.0 or Atom XML into a typed item list. Runs in the
// browser via the built-in DOMParser (zero runtime deps); unit-tested under jsdom.
// It is deliberately dialect-agnostic (matches on element local names, so Atom's
// default namespace is handled) and safe by construction: links are validated to
// http/https and excerpts are reduced to plain text, so nothing renders as markup.

/** A single feed entry, normalised across RSS and Atom. */
export interface FeedItem {
  readonly title: string;
  /** An http(s) URL, or '' if the source link was missing or an unsafe scheme. */
  readonly link: string;
  /** The published/updated timestamp as the feed stated it (not re-formatted). */
  readonly published: string;
  /** Plain-text summary — all markup and script/style content stripped. */
  readonly excerpt: string;
}

/** The result of parsing a feed: either a source + items, or a parse error. */
export type FeedResult =
  | { readonly ok: true; readonly source: string; readonly items: readonly FeedItem[] }
  | { readonly ok: false; readonly error: string };

function firstChild(parent: Element | null, localName: string): Element | null {
  if (!parent) return null;
  return Array.from(parent.children).find((c) => c.localName === localName) ?? null;
}

function childText(parent: Element | null, localName: string): string {
  return firstChild(parent, localName)?.textContent?.trim() ?? '';
}

/** Keep only http(s) URLs; drop `javascript:`, `data:`, relative, or malformed. */
function safeLink(raw: string): string {
  const url = raw.trim();
  if (url === '') return '';
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? url : '';
  } catch {
    return '';
  }
}

/** Reduce HTML (escaped or CDATA) to plain text; script/style content removed. */
function toPlainText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toItem(el: Element): FeedItem {
  const linkEl = firstChild(el, 'link');
  const rawLink = linkEl ? (linkEl.getAttribute('href') ?? linkEl.textContent ?? '') : '';
  return {
    title: childText(el, 'title'),
    link: safeLink(rawLink),
    // RSS: pubDate. Atom: published, falling back to updated.
    published: childText(el, 'pubDate') || childText(el, 'published') || childText(el, 'updated'),
    // RSS: description. Atom: summary, falling back to content.
    excerpt: toPlainText(childText(el, 'description') || childText(el, 'summary') || childText(el, 'content')),
  };
}

/** Parse an RSS 2.0 or Atom feed. Never throws — returns a typed error instead. */
export function parseFeed(xml: string): FeedResult {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { ok: false, error: 'malformed feed XML' };
  }

  const rssItems = Array.from(doc.getElementsByTagName('item'));
  const atomEntries = Array.from(doc.getElementsByTagName('entry'));
  const entryEls = rssItems.length > 0 ? rssItems : atomEntries;
  if (entryEls.length === 0) {
    return { ok: false, error: 'no RSS <item> or Atom <entry> elements found' };
  }

  // Source title: the RSS <channel> title, or the Atom <feed> root's title.
  const channel = doc.getElementsByTagName('channel')[0] ?? null;
  const source = childText(channel ?? doc.documentElement, 'title');

  return { ok: true, source, items: entryEls.map(toItem) };
}
