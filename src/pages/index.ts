// Home page entry. The meta-site's front door: what this repo is and how to use
// it. Page bootstrap follows the fixed Croft idiom — get #app (throw if absent),
// build content, mountShell, register the SW, log that the shell mounted.
import { mountShell } from '../nav';
import { registerServiceWorker } from '../sw-register';
import { log } from '../log';

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

function content(): HTMLElement {
  const section = el('section', 'panel');
  section.append(
    el('h1', undefined, 'Building Croft PWAs'),
    el(
      'p',
      undefined,
      'This is a meta-site about building single-page and progressive web apps ' +
        'the Croft way. It is two things in one repo: the standards, and a ' +
        'reference implementation that proves them. The site you are reading is ' +
        'itself a Croft PWA, built to the standards it documents — so nothing ' +
        'here is a claim the code cannot back up.',
    ),
    el('h2', undefined, 'What lands here'),
    el(
      'p',
      undefined,
      'A chassis (build, service worker, tokens, navigation, the test gate), a ' +
        'brand system on the Croft tectonic palette, an agent working method, a ' +
        'reusable user-guide generator, an atproto/PDA integration module, and a ' +
        'telemetry posture. Each chapter is a real page in this site.',
    ),
    (() => {
      const empty = el('div', 'empty');
      empty.append(
        el('p', undefined, 'Phase 0 is the chassis. The chapters arrive next.'),
        el('span', 'mono', 'standards + reference implementation · one repo'),
      );
      return empty;
    })(),
  );
  return section;
}

const app = document.getElementById('app');
if (!app) throw new Error('index: #app not found');
mountShell(app, content());
registerServiceWorker();
log.info('shell mounted', 'index');
