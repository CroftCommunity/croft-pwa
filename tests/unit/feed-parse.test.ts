// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFeed } from '../../src/reader/feed-parse';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string => readFileSync(join(here, '..', 'fixtures', 'feeds', name), 'utf8');

describe('parseFeed', () => {
  it('parses an RSS 2.0 feed into a source + items', () => {
    const result = parseFeed(fixture('sample-rss.xml'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe('AT Protocol Blog');
    expect(result.items).toHaveLength(2);
    const [first] = result.items;
    expect(first).toBeDefined();
    if (!first) return;
    expect(first).toMatchObject({
      title: 'AT Protocol Trademark',
      link: 'https://atproto.com/blog/at-protocol-trademark',
    });
    expect(first.published).toContain('2025');
    // Escaped HTML in <description> must come out as plain text, no tags.
    expect(first.excerpt).toBe('An update on the AT Protocol trademark and how it may be used.');
    expect(first.excerpt).not.toContain('<');
  });

  it('parses an Atom feed (namespaced, link via href) into the same shape', () => {
    const result = parseFeed(fixture('sample-atom.xml'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe('AT Protocol Blog');
    expect(result.items).toHaveLength(2);
    const [first, second] = result.items;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) return;
    expect(first).toMatchObject({
      title: 'AT Protocol Trademark',
      link: 'https://atproto.com/blog/at-protocol-trademark',
    });
    expect(first.published).toContain('2025');
    expect(second.title).toBe('Federation now open');
  });

  it('returns a typed error for malformed XML', () => {
    const result = parseFeed('<rss><channel><item><title>oops');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(0);
  });

  it('strips embedded HTML from an item excerpt (unescaped markup)', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
      <item><title>x</title><link>https://e.com/a</link>
      <description><![CDATA[Hello <script>alert(1)</script><b>world</b>]]></description></item>
      </channel></rss>`;
    const result = parseFeed(xml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [first] = result.items;
    expect(first).toBeDefined();
    if (!first) return;
    expect(first.excerpt).toBe('Hello world');
    expect(first.excerpt).not.toContain('script');
  });

  it('drops a non-http(s) link scheme (e.g. javascript:)', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
      <item><title>x</title><link>javascript:alert(1)</link><description>d</description></item>
      </channel></rss>`;
    const result = parseFeed(xml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [first] = result.items;
    expect(first).toBeDefined();
    if (!first) return;
    expect(first.link).toBe('');
  });
});
