// atproto / PDA page: documents the read-path standard AND demonstrates it live.
// Enter a handle; the page resolves handle → DID → PDS and reads the public
// profile straight off the network — no server of ours in the middle. This is
// the "read the records, not the pages" posture, running in the browser.
import { mountShell } from '../nav';
import { registerServiceWorker } from '../sw-register';
import { log } from '../log';
import { measure } from '../measure/measure';
import { resolveIdentity, getProfile, AtprotoReadError } from '../atproto/read';
import { generateKeypair, seal, open } from '../crypto/sealedbox';

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
    el('h1', undefined, 'atproto / PDA'),
    el(
      'p',
      undefined,
      'A Croft PWA reads and writes data on the AT Protocol — the user owns their ' +
        'records in their own data server (PDS), and the app is one client among ' +
        'many. The read path needs no login: resolve a handle to a DID, the DID to ' +
        'its PDS, and read the public records. This page does exactly that, live.',
    ),
    el(
      'p',
      'guide-note',
      'Read-only and unauthenticated. Sign-in (OAuth with PKCE + PAR + DPoP) and ' +
        'writes to your own repo are the next phase (skylite is the reference); ' +
        'client-side sealed-box encryption is demonstrated below.',
    ),
  );
  return panel;
}

function sealedDemo(): HTMLElement {
  const panel = el('section', 'panel');
  panel.append(
    el('h2', undefined, 'Sealed box — privacy in public'),
    el(
      'p',
      undefined,
      'A record can live in a public repo yet stay private: seal it to a public ' +
        'key and only the matching private key opens it. Ephemeral ECDH(P-256) → ' +
        'HKDF → AES-GCM, all in the browser. Below: seal a message to a fresh ' +
        "keypair's public half, then open it with the private half.",
    ),
  );

  const input = el('input');
  input.type = 'text';
  input.value = 'meet me at the old croft';
  input.setAttribute('aria-label', 'message to seal');
  input.setAttribute('data-testid', 'seal-input');

  const btn = el('button', 'btn btn-primary', 'Seal & open');
  btn.setAttribute('data-testid', 'seal-button');

  const out = el('div', 'atproto-result');
  out.setAttribute('data-testid', 'seal-result');

  btn.addEventListener('click', () => {
    const msg = input.value;
    out.replaceChildren(el('p', 'mono', 'Sealing…'));
    void (async () => {
      try {
        const { publicKeyJwk, privateKeyJwk } = await generateKeypair();
        const box = await seal(msg, publicKeyJwk);
        const recovered = await open(box, privateKeyJwk);
        const ctP = el('p');
        ctP.append(el('strong', undefined, 'ciphertext '), el('span', 'mono', `${box.ct.slice(0, 44)}…`));
        const recP = el('p');
        recP.setAttribute('data-testid', 'seal-recovered');
        recP.append(el('strong', undefined, 'opened '), el('span', 'mono', recovered));
        out.replaceChildren(ctP, recP);
        log.info('sealed-box round-trip ok');
      } catch (err) {
        out.replaceChildren(el('p', 'mono', 'Sealed-box demo failed (WebCrypto unavailable?)'));
        log.warn('sealed-box demo failed', err);
      }
    })();
  });

  const controls = el('div', 'atproto-controls');
  controls.append(input, btn);
  panel.append(controls, out);
  return panel;
}

function demo(): HTMLElement {
  const panel = el('section', 'panel');
  panel.append(el('h2', undefined, 'Resolve a handle, live'));

  const input = el('input');
  input.type = 'text';
  input.value = 'bsky.app';
  input.setAttribute('aria-label', 'atproto handle');
  input.setAttribute('data-testid', 'handle-input');

  const btn = el('button', 'btn btn-primary', 'Resolve');
  btn.setAttribute('data-testid', 'resolve-button');

  const out = el('div', 'atproto-result');
  out.setAttribute('data-testid', 'resolve-result');

  const row = (label: string, value: string): HTMLElement => {
    const p = el('p');
    p.append(el('strong', undefined, `${label} `), el('span', 'mono', value));
    return p;
  };

  const resolve = (): void => {
    const handle = input.value.trim();
    out.replaceChildren(el('p', 'mono', 'Resolving…'));
    void (async () => {
      try {
        const id = await resolveIdentity(handle);
        const profile = await getProfile(id.did);
        out.replaceChildren(
          row('handle', profile.handle),
          row('did', id.did),
          row('pds', id.pds),
          row('display name', profile.displayName ?? '(none)'),
        );
        log.info('atproto resolve ok', profile.handle);
      } catch (err) {
        const msg = err instanceof AtprotoReadError ? err.message : 'lookup failed';
        out.replaceChildren(el('p', 'mono', `Could not resolve "${handle}": ${msg}`));
        log.warn('atproto resolve failed', err);
      }
    })();
  };
  btn.addEventListener('click', resolve);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') resolve();
  });

  const controls = el('div', 'atproto-controls');
  controls.append(input, btn);
  panel.append(controls, out);
  return panel;
}

function content(): HTMLElement {
  const wrap = el('div');
  wrap.append(intro(), demo(), sealedDemo());
  return wrap;
}

const app = document.getElementById('app');
if (!app) throw new Error('atproto: #app not found');
measure.record('page_atproto');
mountShell(app, content());
registerServiceWorker();
log.info('shell mounted', 'atproto');
