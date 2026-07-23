// Shared shell chrome: every page calls mountShell() so the topbar, tab bar, and
// build stamp are identical across destinations (page-per-destination, no
// router — navigation is real links between real documents, native back button).
import { VERSION } from './version';
import { currentTheme, toggleTheme } from './theme';

interface Tab {
  readonly href: string;
  readonly label: string;
  /** Active when the current pathname matches this pattern. */
  readonly match: RegExp;
}

// P0 ships Home + Settings. The standards chapters (chassis, brand, pwa, agent
// method, user-guide, atproto, telemetry) join this table as their pages land.
const TABS: readonly Tab[] = [
  { href: '/index.html', label: 'Home', match: /^\/(index\.html)?$/ },
  { href: '/user-guide.html', label: 'Guide', match: /^\/user-guide\.html$/ },
  // Standards stays current across its index and every chapter page.
  {
    href: '/reference.html',
    label: 'Standards',
    match: /^\/(reference|chassis|brand|pwa|agent-method)\.html$/,
  },
  { href: '/settings.html', label: 'Settings', match: /^\/settings\.html$/ },
];

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

function renderTopbar(): HTMLElement {
  const bar = el('header', 'topbar');

  const wordmark = el('a', 'wordmark', 'Croft PWA');
  wordmark.href = '/index.html';

  const theme = el('button', 'topbar-action');
  const paint = (): void => {
    theme.textContent = currentTheme() === 'dark' ? 'Light' : 'Dark';
    theme.setAttribute('aria-label', 'Toggle colour theme');
  };
  paint();
  theme.addEventListener('click', () => {
    toggleTheme();
    paint();
  });

  bar.append(wordmark, theme);
  return bar;
}

function renderTabs(pathname: string): HTMLElement {
  const nav = el('nav', 'tabs');
  nav.setAttribute('aria-label', 'Sections');
  for (const tab of TABS) {
    const link = el('a', 'tab', tab.label);
    link.href = tab.href;
    if (tab.match.test(pathname)) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  return nav;
}

function renderBuildStamp(): HTMLElement {
  const footer = el('footer', 'build-stamp');
  const stamp = el('span', 'mono', VERSION);
  stamp.setAttribute('data-version-stamp', '');
  footer.append(stamp);
  return footer;
}

/** Render the full shell (topbar + tabs + main content + build stamp) into #app. */
export function mountShell(app: HTMLElement, content: HTMLElement): void {
  const main = el('main');
  main.append(content);
  app.append(renderTopbar(), renderTabs(location.pathname), main, renderBuildStamp());
}
