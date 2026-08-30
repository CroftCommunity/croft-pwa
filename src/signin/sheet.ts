// The mobile sign-in sheet — the reference implementation of
// docs/DESIGN.md § Components › Sheet, § Flows › Sign in and § Copy › atmo.
// Lifted from forage (js/ui/lens-views.js authSheet(), 2026-08-27..29).
//
// Native <dialog> + showModal(), NOT a hand-rolled div. Probed under a harness
// rather than assumed (forage, Phase 0 D2): it supplies focus entry, Esc,
// focus return to the trigger, and background inertness with no code, and axe
// can see inside an open one. Modals are precisely where hand-rolling fails,
// and every one of those behaviours is a thing a keyboard visitor needs and a
// sighted mouse user never notices missing. This is the recorded exception to
// the navigation law ("pages, not modals"): a choose-one step that returns you
// where you were.
//
// Built FRESH per open and removed on close: the rows are static, but the
// handle field is not, and a lingering singleton would carry a half-typed
// handle from one visit into the next.
import { ATMO_GLOSS, featuredProviders, otherProviders, canCreateAccount, type Provider } from './providers';

export interface ChooseOptions {
  readonly prompt?: 'create';
}

export interface SheetHandlers {
  /** `target` is a provider entryway (https origin) or a handle. */
  readonly onChoose: (target: string, options?: ChooseOptions) => void;
  /** Called with an empty handle submission; the sheet stays open. */
  readonly onEmptyHandle: () => void;
}

type Attrs = Readonly<Record<string, string | boolean>>;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: readonly (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false) continue;
    if (k === 'hidden') node.hidden = true;
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...kids);
  return node;
}

// One row shape for both panels. The two-direction rule (open offers Create,
// invite-only shows the WORDS in the create slot) is a property of the
// provider, not of the panel it sits on — so a provider that changes posture
// moves panels and changes its controls in one edit to the registry.
function providerRow(p: Provider, h: SheetHandlers): HTMLElement {
  const actions = el('div', { class: 'sheet-actions' });
  if (canCreateAccount(p)) {
    // prompt=create is not decoration: driven end to end against the open
    // providers (forage, Phase 0 D1), it lands in the registration wizard
    // rather than the sign-in screen. Without that evidence this button and
    // the one beside it would be two routes to one page wearing different words.
    const create = el('button', { type: 'button', class: 'btn btn-primary btn-sm', 'data-provider-create': '' }, 'Create account');
    create.addEventListener('click', () => h.onChoose(p.entryway, { prompt: 'create' }));
    actions.append(create);
  } else {
    // The words sit in the CREATE slot rather than after the row, so the column
    // stays aligned and the italic explains the button that is missing. An
    // invite-only provider still ADVERTISES create; offering it would send
    // someone to a screen that then demands a code.
    actions.append(el('span', { class: 'sheet-invite' }, 'invite only'));
  }
  const go = el('button', { type: 'button', class: 'btn btn-secondary btn-sm', 'data-provider-signin': '' }, 'Sign in');
  go.addEventListener('click', () => h.onChoose(p.entryway));
  actions.append(go);
  return el('div', { class: 'sheet-row', 'data-provider-row': p.id }, el('span', { class: 'sheet-provider' }, p.label), actions);
}

export function signInSheet(h: SheetHandlers): HTMLDialogElement {
  const titleId = 'signin-sheet-title';
  const dialog = el('dialog', { class: 'signin-sheet', 'data-signin-sheet': '', 'aria-labelledby': titleId });
  const close = el('button', { type: 'button', class: 'sheet-x', 'aria-label': 'Close' }, '✕');
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove());

  // The front page is the providers a newcomer can JOIN from here (owner,
  // 2026-08-29). Invite-only providers are one tap in, below.
  const list = el('div', { class: 'sheet-list' }, ...featuredProviders().map((p) => providerRow(p, h)));

  // Everything not on the short list reaches the same seam. The list is an
  // editorial convenience, not a boundary — this is what keeps it from being
  // one. The panel carries the invite-only providers first, then the handle
  // field for any atproto host at all.
  const handle = el('input', {
    type: 'text', id: 'signin-sheet-handle', 'data-provider-handle': '', placeholder: 'you.example.com',
    autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false',
  });
  const form = el('form', { class: 'sheet-other-form' },
    el('label', { for: 'signin-sheet-handle', class: 'sheet-label' }, 'Your handle on any atmo provider'),
    el('div', { class: 'sheet-handle-row' }, handle,
      el('button', { type: 'submit', class: 'btn btn-primary btn-sm', 'data-provider-handle-go': '' }, 'Continue')));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = handle.value.trim().replace(/^@+/, '');
    if (!v) return h.onEmptyHandle();
    h.onChoose(v);
  });
  const panel = el('div', { class: 'sheet-other', hidden: true },
    el('div', { class: 'sheet-list' }, ...otherProviders().map((p) => providerRow(p, h))), form);
  const other = el('button', { type: 'button', class: 'btn btn-secondary sheet-more', 'data-provider-other': '' }, 'Another provider');
  other.addEventListener('click', () => { other.hidden = true; panel.hidden = false; handle.focus(); });

  // "atmo" is the owner's word (2026-08-29) for a home on the open social
  // Atmosphere. The gloss is a native <abbr title>: it hovers on a desktop and
  // assistive tech reads it, but touch cannot hover — so the sentence below
  // says the same thing in plain sight, and the tooltip is a bonus, not the
  // only copy of the definition.
  const intro = `This app has no accounts of its own. You sign in with an account from an atmo provider — ${ATMO_GLOSS.charAt(0).toLowerCase()}${ATMO_GLOSS.slice(1)}. Bluesky is one of many, and each sets its own rules.`;
  dialog.append(
    el('div', { class: 'sheet-head' },
      el('h2', { id: titleId }, 'Choose your ', el('abbr', { class: 'sheet-gloss', title: ATMO_GLOSS }, 'atmo'), ' provider'), close),
    el('p', { class: 'sheet-intro' }, intro),
    list, other, panel);
  return dialog;
}

/** Mount a fresh sheet under `host` and open it modally. */
export function openSignInSheet(host: HTMLElement, h: SheetHandlers): HTMLDialogElement {
  const sheet = signInSheet(h);
  host.append(sheet);
  sheet.showModal();
  return sheet;
}
