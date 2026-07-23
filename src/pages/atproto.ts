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
import { beginAuthorization, completeAuthorization, type OAuthSession, type PendingAuth } from '../atproto/oauth/client';

// OAuth sign-in (PKCE + PAR + DPoP). client_id is the hosted client-metadata.json
// (must match its redirect_uris); redirect_uri is derived from the live origin so
// the same code round-trips correctly on GitHub Pages, a project-page preview, or
// the local dev/test server. The pending auth (PKCE verifier + DPoP key) has to
// survive the full-page redirect to the PDS and back, so it lives in
// sessionStorage — cleared once consumed, and never written to localStorage
// (the key-at-rest vault that would make a persistent session safe is a later
// increment; see docs/ATPROTO.md).
const OAUTH_CLIENT_ID = 'https://croftcommunity.github.io/croft-pwa/client-metadata.json';
const OAUTH_SCOPE = 'atproto transition:generic';
const OAUTH_PENDING_KEY = 'croft-atproto-oauth-pending';

function redirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
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
      'Read-only and unauthenticated above; sign in below with OAuth (PKCE + PAR + ' +
        'DPoP) to prove the authenticated half. Writes to your own repo and the ' +
        'key-at-rest vault are the next increment (skylite is the reference); ' +
        'client-side sealed-box encryption is demonstrated further down.',
    ),
  );
  return panel;
}

interface SignInUi {
  readonly panel: HTMLElement;
  readonly showSession: (session: OAuthSession) => void;
  readonly showError: (message: string) => void;
}

function signInSection(): SignInUi {
  const panel = el('section', 'panel');
  panel.append(
    el('h2', undefined, 'Sign in with your PDS'),
    el(
      'p',
      undefined,
      'OAuth for a public client — authorization-code + PKCE + a pushed ' +
        'authorization request (PAR), with DPoP-bound tokens. No password crosses ' +
        'this page: you authenticate on your own PDS, and only a DPoP-bound access ' +
        'token comes back.',
    ),
  );

  const input = el('input');
  input.type = 'text';
  input.value = 'bsky.app';
  input.setAttribute('aria-label', 'atproto handle to sign in with');
  input.setAttribute('data-testid', 'signin-handle-input');

  const btn = el('button', 'btn btn-primary', 'Sign in');
  btn.setAttribute('data-testid', 'signin-button');

  const out = el('div', 'atproto-result');
  out.setAttribute('data-testid', 'signin-result');

  const showSession = (session: OAuthSession): void => {
    const p = el('p');
    p.setAttribute('data-testid', 'signin-did');
    p.append(el('strong', undefined, 'Signed in as '), el('span', 'mono', session.did));
    out.replaceChildren(p);
  };
  const showError = (message: string): void => {
    out.replaceChildren(el('p', 'mono', message));
  };

  btn.addEventListener('click', () => {
    const handle = input.value.trim();
    out.replaceChildren(el('p', 'mono', 'Resolving your PDS and starting sign-in…'));
    void (async () => {
      try {
        const { authorizeUrl, pending } = await beginAuthorization(handle, {
          clientId: OAUTH_CLIENT_ID,
          redirectUri: redirectUri(),
          scope: OAUTH_SCOPE,
        });
        sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(pending));
        window.location.href = authorizeUrl;
      } catch (err) {
        showError(`Could not start sign-in: ${err instanceof Error ? err.message : 'unknown error'}`);
        log.warn('oauth beginAuthorization failed', err);
      }
    })();
  });

  const controls = el('div', 'atproto-controls');
  controls.append(input, btn);
  panel.append(controls, out);
  return { panel, showSession, showError };
}

/** If this load is the OAuth redirect back from the PDS, complete the exchange. */
async function handleOAuthCallback(ui: SignInUi): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return;

  history.replaceState(null, '', window.location.pathname);
  const pendingRaw = sessionStorage.getItem(OAUTH_PENDING_KEY);
  if (!pendingRaw) {
    ui.showError('No pending sign-in found for this callback (session lost?). Try signing in again.');
    return;
  }
  sessionStorage.removeItem(OAUTH_PENDING_KEY);
  try {
    const pending = JSON.parse(pendingRaw) as PendingAuth;
    const session = await completeAuthorization(pending, { code, state }, {
      clientId: OAUTH_CLIENT_ID,
      redirectUri: redirectUri(),
      scope: OAUTH_SCOPE,
    });
    ui.showSession(session);
    log.info('oauth sign-in ok', session.did);
  } catch (err) {
    ui.showError(`Sign-in failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    log.warn('oauth completeAuthorization failed', err);
  }
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

function content(): { node: HTMLElement; signin: SignInUi } {
  const wrap = el('div');
  const signin = signInSection();
  wrap.append(intro(), demo(), signin.panel, sealedDemo());
  return { node: wrap, signin };
}

const app = document.getElementById('app');
if (!app) throw new Error('atproto: #app not found');
measure.record('page_atproto');
const { node, signin } = content();
mountShell(app, node);
registerServiceWorker();
void handleOAuthCallback(signin);
log.info('shell mounted', 'atproto');
