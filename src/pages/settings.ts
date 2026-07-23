// Settings page entry. P0 exposes the theme control and the running build stamp
// (the same VERSION the SW cache is keyed to), so a human or agent can confirm
// which build is live.
import { mountShell } from '../nav';
import { registerServiceWorker } from '../sw-register';
import { currentTheme, toggleTheme, type Theme } from '../theme';
import { VERSION } from '../version';
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

function content(): HTMLElement {
  const section = el('section', 'panel');

  const themeBtn = el('button', 'btn btn-secondary');
  const paint = (theme: Theme): void => {
    themeBtn.textContent = `Theme: ${theme} (tap to switch)`;
  };
  paint(currentTheme());
  themeBtn.addEventListener('click', () => paint(toggleTheme()));

  const build = el('p', 'mono');
  build.textContent = `build ${VERSION}`;
  build.setAttribute('data-version-stamp', '');

  section.append(
    el('h1', undefined, 'Settings'),
    el('h2', undefined, 'Appearance'),
    themeBtn,
    el('h2', undefined, 'This build'),
    build,
  );
  return section;
}

const app = document.getElementById('app');
if (!app) throw new Error('settings: #app not found');
measure.record('page_settings');
mountShell(app, content());
registerServiceWorker();
log.info('shell mounted', 'settings');
