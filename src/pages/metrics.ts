// Metrics page: the local view of usage measurement. Shows what is measured (with
// each metric's plain-language disclosure and expiry), the current local counts,
// recent local-only events, and the EXACT payload a flush would send — plus the
// opt-in/out sharing toggle. Nothing here is transmitted; a flush logs to the
// console "as if" a remote were receiving it.
import { mountShell } from '../nav';
import { registerServiceWorker } from '../sw-register';
import { log } from '../log';
import { METRICS } from '../measure/registry';
import { measure } from '../measure/measure';
import { getConsent, setConsent } from '../measure/consent';
import { isActive } from '../measure/expiry';

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

function pre(text: string): HTMLElement {
  const p = el('pre');
  p.append(el('code', undefined, text));
  return p;
}

function consentPanel(): HTMLElement {
  const panel = el('section', 'panel');
  panel.append(
    el('h2', undefined, 'Sharing'),
    el(
      'p',
      undefined,
      'Counting happens on this device and is always shown below — it never leaves ' +
        'unless you turn sharing on. Even then, no remote is configured here, so a ' +
        'flush only writes the payload to the console. This is the opt-in/out switch.',
    ),
  );
  const btn = el('button', 'btn btn-secondary');
  btn.setAttribute('data-testid', 'consent-toggle');
  const paint = (): void => {
    btn.textContent = `Sharing: ${getConsent() ? 'on' : 'off'} (tap to change)`;
    btn.setAttribute('aria-pressed', String(getConsent()));
  };
  paint();
  btn.addEventListener('click', () => {
    setConsent(!getConsent());
    paint();
  });
  panel.append(btn);
  return panel;
}

function registryPanel(): HTMLElement {
  const panel = el('section', 'panel');
  panel.append(
    el('h2', undefined, 'What is measured'),
    el(
      'p',
      undefined,
      'Every metric is declared once, with a plain-language line describing exactly ' +
        'what it records and a date after which it stops on its own.',
    ),
  );
  const list = el('ul', 'measure-list');
  for (const [name, meta] of METRICS) {
    const li = el('li');
    li.append(el('span', 'mono', name));
    li.append(el('span', undefined, ` — ${meta.disclosure}. `));
    const active = isActive(meta, measure.today);
    li.append(el('span', 'mono', `${meta.type} · expires ${meta.expires}${active ? '' : ' · EXPIRED'}`));
    list.append(li);
  }
  panel.append(list);
  return panel;
}

function countsPanel(): HTMLElement {
  const panel = el('section', 'panel');
  const snap = measure.snapshot();
  const entries = Object.entries(snap.counts);
  panel.append(el('h2', undefined, 'Your local counts (this device, this month)'));
  if (entries.length === 0) {
    const empty = el('div', 'empty');
    empty.append(el('p', undefined, 'Nothing counted yet. Move around the site and come back.'));
    panel.append(empty);
  } else {
    const list = el('ul', 'measure-list');
    for (const [name, count] of entries) {
      const li = el('li');
      li.setAttribute('data-count', name);
      li.append(el('span', 'mono', name), el('span', undefined, `  ${count}`));
      list.append(li);
    }
    panel.append(list);
  }
  panel.append(
    el('p', 'mono', `device ${snap.deviceId} · session ${snap.sessionId} — local only, never sent`),
  );
  return panel;
}

function eventsPanel(): HTMLElement {
  const panel = el('section', 'panel');
  const snap = measure.snapshot();
  panel.append(
    el('h2', undefined, 'Recent local events'),
    el('p', 'guide-note', 'These carry ordering and fine timestamps. They stay on the device and are never part of a flush.'),
  );
  const recent = snap.events.slice(-10).reverse();
  const list = el('ul', 'measure-list');
  for (const ev of recent) {
    const li = el('li');
    li.append(el('span', 'mono', `${new Date(ev.at).toISOString()} ${ev.name} ${ev.page}`));
    list.append(li);
  }
  panel.append(list);
  return panel;
}

function wirePanel(): HTMLElement {
  const panel = el('section', 'panel');
  const { payload, problems } = measure.wirePreview();
  panel.append(
    el('h2', undefined, 'The only thing a flush sends'),
    el(
      'p',
      undefined,
      'An unordered bag of counts plus the coarse month. No ordering, no timestamps, ' +
        'no identity — the serialiser cannot read them.',
    ),
    pre(JSON.stringify(payload, null, 2)),
  );
  if (problems.length > 0) {
    panel.append(el('p', 'mono', `schema problems: ${problems.join('; ')}`));
  }

  const btn = el('button', 'btn btn-primary');
  btn.setAttribute('data-testid', 'flush-now');
  btn.textContent = 'Preview a flush (writes to the console)';
  const status = el('p', 'mono');
  const last = measure.lastFlush();
  if (last) status.textContent = `last flush ${new Date(last.at).toISOString()} · ${last.transmitted ? 'transmitted' : 'held (sharing off)'}`;
  btn.addEventListener('click', () => {
    const res = measure.flushNow();
    status.textContent = `last flush ${new Date(res.at).toISOString()} · ${res.transmitted ? 'transmitted' : 'held (sharing off)'}`;
  });
  panel.append(btn, status);
  return panel;
}

function content(): HTMLElement {
  const wrap = el('div');
  const intro = el('section', 'panel');
  intro.append(
    el('h1', undefined, 'Metrics'),
    el(
      'p',
      undefined,
      'Usage measurement, shown in full. This is the counter-based, ' +
        'privacy-preserving design being trialled here before it lands in other ' +
        'Croft apps — everything is local, and you can see exactly what a flush ' +
        'would carry.',
    ),
  );
  wrap.append(intro, consentPanel(), countsPanel(), wirePanel(), registryPanel(), eventsPanel());
  return wrap;
}

const app = document.getElementById('app');
if (!app) throw new Error('metrics: #app not found');
measure.record('page_metrics');
mountShell(app, content());
registerServiceWorker();
log.info('shell mounted', 'metrics');
