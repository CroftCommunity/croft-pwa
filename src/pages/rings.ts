// Rings: the pds-walker library's reference page (plan 2026-09-08 § Phase 6a — the shell).
// Enter a handle; the page walks that account's rings live from the data servers, drawing
// each ring as it fills, with an "as of" stamp, and lists the hosts it could not reach.
// The walker is imported through the package's own export path — the reference proves the
// export (SHARED-CODE.md rule 2) — and is handed this page's logger, so its lines carry the
// `[croft]` tag and obey `?debug=1` like every other line here.
import { mountShell } from '../nav';
import { registerServiceWorker } from '../sw-register';
import { log } from '../log';
import { measure } from '../measure/measure';
import { resolveHandle, AtprotoReadError } from '../atproto/read';
import { createWalker, createFetchTransport, indexedDbStore, type Ring, type RingId, type HostState, type Progress, type Walker } from 'croft-pwa/pds-walker';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

type CardSpec = { readonly id: 'mut' | 'fol' | 'global' | 'hop' | 'hop2'; readonly title: string; readonly blurb: string };
// The default three (owner 2026-09-08: mutuals · follows · global) and, behind a native
// disclosure, the two optional outer rings (OQ6 c: hop = everyone your mutuals follow,
// hop2 = everyone your follows follow). "Pages, not modals": a <details>, not an overlay.
const DEFAULT_CARDS: readonly CardSpec[] = [
  { id: 'mut', title: 'Mutuals', blurb: 'People who follow you back.' },
  { id: 'fol', title: 'Follows', blurb: 'Everyone you follow.' },
  { id: 'global', title: 'Global', blurb: 'Everything — the worldwide view. Not walked here; that is the AppView’s job.' },
];
const MORE_CARDS: readonly CardSpec[] = [
  { id: 'hop', title: 'One hop out', blurb: 'Everyone your mutuals follow.' },
  { id: 'hop2', title: 'Two hops out', blurb: 'Everyone your follows follow.' },
];

function card(spec: CardSpec): HTMLElement {
  const section = el('section', 'panel ring-card');
  section.dataset['ring'] = spec.id;
  const count = el('p', 'ring-count', spec.id === 'global' ? '∞' : '—');
  count.dataset['count'] = '';
  const asOf = el('p', 'ring-asof', spec.id === 'global' ? 'the AppView, not this page' : 'as of —');
  asOf.dataset['asof'] = '';
  section.append(el('h2', undefined, spec.title), count, asOf, el('p', undefined, spec.blurb));
  return section;
}

function intro(): HTMLElement {
  const panel = el('section', 'panel');
  panel.append(
    el('h1', undefined, 'Rings'),
    el('p', undefined,
      'Your social rings, walked from the data servers directly — no relay, no AppView. ' +
      'Each ring says when it was last read and whether every source was reachable; a server ' +
      'that cannot be reached is listed as unknown, never counted as empty.'),
  );
  const form = el('form', 'ring-form');
  const input = el('input');
  input.type = 'text';
  input.placeholder = 'handle, e.g. bsky.app';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'handle to walk');
  input.setAttribute('data-testid', 'rings-handle');
  const walk = el('button', 'btn btn-primary', 'Walk');
  walk.type = 'submit';
  walk.setAttribute('data-testid', 'rings-walk');
  form.append(input, walk);
  const progress = el('p', 'ring-progress', 'Enter a handle to begin.');
  progress.setAttribute('aria-live', 'polite');
  progress.dataset['progress'] = '';
  panel.append(form, progress);
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    void startWalk(input.value.trim(), progress);
  });
  return panel;
}

// ---- the walk ------------------------------------------------------------------------
const SHOWN: readonly RingId[] = ['mut', 'fol', 'hop', 'hop2'];
let current: Walker | null = null;
const fmtTime = (ms: number): string => new Date(ms).toLocaleTimeString();

function renderRing(r: Ring): void {
  const card = document.querySelector(`[data-ring="${r.id}"]`);
  if (card === null) return;
  const count = card.querySelector('[data-count]');
  const asOf = card.querySelector('[data-asof]');
  // Counts exclude the account itself: "follows" means everyone you follow, not you.
  if (count !== null) count.textContent = String(Math.max(0, r.members.size - 1));
  if (asOf !== null) asOf.textContent = r.asOf === 0 ? 'as of —' : `as of ${fmtTime(r.asOf)} · ${r.complete ? 'complete' : 'incomplete'}`;
}
function renderHosts(hosts: readonly HostState[]): void {
  const panel = document.querySelector('[data-hosts]');
  if (panel === null) return;
  const unknown = hosts.filter((h) => h.state === 'unknown');
  const reached = hosts.length - unknown.length;
  panel.replaceChildren(el('h2', undefined, 'Hosts'));
  if (hosts.length === 0) { panel.append(el('p', undefined, 'No hosts reached yet.')); return; }
  panel.append(el('p', undefined, `${reached} reached${unknown.length > 0 ? `, ${unknown.length} unknown` : ''}.`));
  if (unknown.length > 0) {
    const list = el('ul');
    for (const h of unknown) list.append(el('li', undefined, `${h.host} — unknown since ${fmtTime(h.since)}: ${h.reason ?? 'no reason given'}`));
    panel.append(list);
  }
}
async function startWalk(handle: string, progress: HTMLElement): Promise<void> {
  if (handle === '') { progress.textContent = 'Enter a handle to begin.'; return; }
  current?.stop();
  progress.textContent = 'Resolving the handle…';
  let did: string;
  try {
    did = await resolveHandle(handle);
  } catch (err) {
    log.warn('rings: resolveHandle failed', err instanceof AtprotoReadError ? err.message : err);
    progress.textContent = 'That handle could not be resolved.';
    return;
  }
  log.info('rings: walk started');
  const walker = createWalker({ transport: createFetchTransport({ log }), store: indexedDbStore('croft-pwa-rings'), log });
  current = walker;
  walker.on('ring', (e) => { const r = e as Ring; if (SHOWN.includes(r.id)) renderRing(r); });
  walker.on('host', () => renderHosts(walker.hosts()));
  walker.on('progress', (e) => { const p = e as Progress; progress.textContent = `${p.done} of ${p.total} followees listed.`; renderHosts(walker.hosts()); });
  progress.textContent = 'Walking ring 1…';
  await walker.walk(did as `did:${string}`);
  renderHosts(walker.hosts());
  if (walker.ring('fol').members.size <= 1) progress.textContent = 'Ring 1 read; nothing to walk further.';
  await walker.idle();
  renderHosts(walker.hosts());
}

function hosts(): HTMLElement {
  const panel = el('section', 'panel');
  panel.dataset['hosts'] = '';
  panel.append(el('h2', undefined, 'Hosts'), el('p', undefined, 'No hosts reached yet.'));
  return panel;
}

const app = document.getElementById('#app'.slice(1));
if (app === null) throw new Error('#app missing');
measure.record('page_rings');
const content = el('div');
const grid = el('div', 'ring-grid');
for (const spec of DEFAULT_CARDS) grid.append(card(spec));
const more = el('details', 'ring-more');
more.dataset['moreRings'] = '';
more.append(el('summary', undefined, 'More rings'));
const moreGrid = el('div', 'ring-grid');
for (const spec of MORE_CARDS) moreGrid.append(card(spec));
more.append(moreGrid);
content.append(intro(), grid, more, hosts());
mountShell(app, content);
registerServiceWorker();
log.info('shell mounted', 'rings');
