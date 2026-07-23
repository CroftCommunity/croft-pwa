// Shared shell chrome: every page calls mountShell() so the topbar, tab bar, and
// build stamp are identical across destinations (page-per-destination, no
// router — navigation is real links between real documents, native back button).
import { VERSION } from './version';
import { currentTheme, toggleTheme } from './theme';
import { measure } from './measure/measure';

interface Tab {
  /** Relative href (works at a domain root or a project subpath). */
  readonly href: string;
  readonly label: string;
  /** The page basenames on which this tab is the current one. */
  readonly active: readonly string[];
}

const TABS: readonly Tab[] = [
  { href: 'index.html', label: 'Home', active: ['index.html'] },
  { href: 'user-guide.html', label: 'Guide', active: ['user-guide.html'] },
  // Standards stays current across its index and every chapter page.
  {
    href: 'reference.html',
    label: 'Standards',
    active: ['reference.html', 'chassis.html', 'brand.html', 'pwa.html', 'agent-method.html'],
  },
  { href: 'metrics.html', label: 'Metrics', active: ['metrics.html'] },
  { href: 'settings.html', label: 'Settings', active: ['settings.html'] },
];

/** The current page's basename, treating the directory root as index.html. */
function currentPage(): string {
  const last = location.pathname.split('/').pop();
  return last && last.length > 0 ? last : 'index.html';
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

function renderTopbar(): HTMLElement {
  const bar = el('header', 'topbar');

  const wordmark = el('a', 'wordmark', 'Croft PWA');
  wordmark.href = 'index.html';

  const theme = el('button', 'topbar-action');
  const paint = (): void => {
    theme.textContent = currentTheme() === 'dark' ? 'Light' : 'Dark';
    theme.setAttribute('aria-label', 'Toggle colour theme');
  };
  paint();
  theme.addEventListener('click', () => {
    toggleTheme();
    measure.record('feature_theme_toggle');
    paint();
  });

  bar.append(wordmark, theme);
  return bar;
}

function renderTabs(page: string): HTMLElement {
  const nav = el('nav', 'tabs');
  nav.setAttribute('aria-label', 'Sections');
  for (const tab of TABS) {
    const link = el('a', 'tab', tab.label);
    link.href = tab.href;
    if (tab.active.includes(page)) link.setAttribute('aria-current', 'page');
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
  app.append(renderTopbar(), renderTabs(currentPage()), main, renderBuildStamp());
}
