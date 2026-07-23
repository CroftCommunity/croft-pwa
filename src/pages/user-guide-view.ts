// Browser-side renderer for the user guide. Pure of network and auth: it turns
// the guide data (guide-content.ts) into DOM. The data is unit-tested in node;
// this rendering is exercised by tests/e2e/user-guide.spec.ts in a real browser.
import type { GuideBlock, GuideEntry } from './guide-content';

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

function renderBlock(block: GuideBlock): HTMLElement {
  switch (block.kind) {
    case 'prose':
      return el('p', undefined, block.text);
    case 'note': {
      const note = el('p', 'guide-note');
      note.append(el('strong', undefined, 'Note. '), document.createTextNode(block.text));
      return note;
    }
    case 'steps': {
      const list = el('ol', 'guide-steps');
      for (const item of block.items) list.append(el('li', undefined, item));
      return list;
    }
    case 'shot': {
      const fig = el('figure', 'guide-shot');
      const img = el('img');
      img.src = `./assets/guide/${block.name}.jpg`;
      img.alt = block.alt;
      img.loading = 'lazy';
      fig.append(img, el('figcaption', undefined, block.caption));
      return fig;
    }
  }
}

/** Build the full guide: intro, a table of contents, then one section per entry. */
export function renderGuide(entries: readonly GuideEntry[]): HTMLElement {
  const wrap = el('div');

  const intro = el('section', 'panel');
  intro.append(
    el('h1', undefined, 'How to build a Croft PWA'),
    el(
      'p',
      undefined,
      'A short tour of the standard, in the order you would build one. Every ' +
        'section describes what a piece is for; the repo itself is the worked example.',
    ),
  );

  const toc = el('nav', 'guide-toc');
  toc.setAttribute('aria-label', 'Contents');
  const tocList = el('ul');
  for (const entry of entries) {
    const li = el('li');
    const link = el('a', undefined, entry.toc);
    link.href = `#${entry.testid}`;
    li.append(link);
    tocList.append(li);
  }
  toc.append(tocList);
  intro.append(toc);
  wrap.append(intro);

  for (const entry of entries) {
    const section = el('section', 'panel guide-entry');
    section.id = entry.testid;
    section.setAttribute('data-testid', entry.testid);
    section.append(el('h2', undefined, entry.title));
    for (const block of entry.blocks) section.append(renderBlock(block));
    wrap.append(section);
  }

  return wrap;
}
