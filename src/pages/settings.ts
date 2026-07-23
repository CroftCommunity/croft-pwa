// Settings page entry. Exposes the theme control, the running build stamp, an
// Update control (the explicit half of "ask, don't ambush"), and an About
// section with the Croft attribution.
import { mountShell } from '../nav';
import {
  registerServiceWorker,
  onUpdateAvailable,
  applyUpdate,
  checkForUpdate,
  isUpdateWaiting,
} from '../sw-register';
import { currentTheme, toggleTheme, type Theme } from '../theme';
import { VERSION } from '../version';
import { log } from '../log';
import { measure } from '../measure/measure';

const CROFT_HOME = 'https://croft.ing';

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

function appearancePanel(): HTMLElement {
  const panel = el('section', 'panel');
  const themeBtn = el('button', 'btn btn-secondary');
  const paint = (theme: Theme): void => {
    themeBtn.textContent = `Theme: ${theme} (tap to switch)`;
  };
  paint(currentTheme());
  themeBtn.addEventListener('click', () => paint(toggleTheme()));
  panel.append(el('h2', undefined, 'Appearance'), themeBtn);
  return panel;
}

function updatePanel(): HTMLElement {
  const panel = el('section', 'panel');
  const build = el('p', 'mono');
  build.textContent = `build ${VERSION}`;
  build.setAttribute('data-version-stamp', '');

  const status = el('p', undefined);
  const btn = el('button', 'btn btn-primary');
  btn.setAttribute('data-testid', 'update-button');

  // The button applies a waiting update; when none is waiting it checks for one.
  // "Ask, don't ambush": nothing reloads until the user presses this (or the toast).
  const toReady = (): void => {
    btn.textContent = 'Update available — reload to apply';
    status.textContent = 'A newer version has been downloaded.';
  };
  const toIdle = (): void => {
    btn.textContent = 'Check for updates';
    status.textContent = "You're on the latest version.";
  };
  if (isUpdateWaiting()) toReady();
  else toIdle();
  onUpdateAvailable(toReady);

  btn.addEventListener('click', () => {
    if (isUpdateWaiting()) {
      applyUpdate();
      return;
    }
    status.textContent = 'Checking…';
    void checkForUpdate().then((waiting) => {
      if (waiting) toReady();
      else status.textContent = "You're on the latest version.";
    });
  });

  panel.append(el('h2', undefined, 'Updates'), status, btn, build);
  return panel;
}

function aboutPanel(): HTMLElement {
  const panel = el('section', 'panel');
  const croft = el('a', undefined, 'Croft');
  croft.href = CROFT_HOME;
  const p = el('p');
  p.append(
    document.createTextNode('croft-pwa is a meta-site about building Croft SPA/PWAs — the '),
    document.createTextNode('standards and a reference implementation in one repo. It is itself a '),
    document.createTextNode('Croft project ('),
    croft,
    document.createTextNode(').'),
  );
  panel.append(el('h2', undefined, 'About'), p);
  return panel;
}

function content(): HTMLElement {
  const wrap = el('div');
  const intro = el('section', 'panel');
  intro.append(el('h1', undefined, 'Settings'));
  wrap.append(intro, appearancePanel(), updatePanel(), aboutPanel());
  return wrap;
}

const app = document.getElementById('app');
if (!app) throw new Error('settings: #app not found');
measure.record('page_settings');
mountShell(app, content());
registerServiceWorker();
log.info('shell mounted', 'settings');
