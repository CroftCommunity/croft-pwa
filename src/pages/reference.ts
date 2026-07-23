// Standards index (reference.html): the overview that links to each chapter.
// Keeps the top nav to four tabs while the chapters live one level down.
import { mountShell } from '../nav';
import { registerServiceWorker } from '../sw-register';
import { log } from '../log';
import { measure } from '../measure/measure';

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

interface Chapter {
  readonly href: string;
  readonly title: string;
  readonly blurb: string;
}

const CHAPTERS: readonly Chapter[] = [
  {
    href: 'chassis.html',
    title: 'Chassis',
    blurb: 'Pages not a framework, one self-contained build, a service worker that never strands a fix.',
  },
  {
    href: 'brand.html',
    title: 'Brand',
    blurb: 'A tuned tectonic palette with colour in one file, contrast recorded and checked, two honest themes.',
  },
  {
    href: 'pwa.html',
    title: 'PWA mechanics',
    blurb: 'Security built into the artifact, install and offline, and the console as the debugger.',
  },
  {
    href: 'agent-method.html',
    title: 'Agent method',
    blurb: 'Test first, plans that record the why, run summaries that carry the evidence.',
  },
];

function content(): HTMLElement {
  const wrap = el('div');

  const intro = el('section', 'panel');
  intro.append(
    el('h1', undefined, 'Standards'),
    el(
      'p',
      undefined,
      'The Croft PWA standard, in chapters. Each is a real page in this site, and ' +
        'each rule is one this repo keeps by passing its own checks. For the ' +
        'build-order tour, see the guide; for the long form, see the docs on GitHub.',
    ),
  );
  wrap.append(intro);

  for (const chapter of CHAPTERS) {
    const card = el('section', 'panel');
    const link = el('a', undefined, chapter.title);
    link.href = chapter.href;
    const h2 = el('h2');
    h2.append(link);
    card.append(h2, el('p', undefined, chapter.blurb));
    card.setAttribute('data-chapter', '');
    wrap.append(card);
  }

  return wrap;
}

const app = document.getElementById('app');
if (!app) throw new Error('reference: #app not found');
measure.record('page_standards');
mountShell(app, content());
registerServiceWorker();
log.info('shell mounted', 'reference');
