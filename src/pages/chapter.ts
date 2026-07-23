// Shared wiring for a standards chapter page: render a chapter's entries with a
// heading in the shared shell. Keeps each chapter entry point to a few lines.
import { mountShell } from '../nav';
import { registerServiceWorker } from '../sw-register';
import { log } from '../log';
import { renderGuide, type GuideHeading } from './user-guide-view';
import type { GuideEntry } from './guide-content';

export function mountChapter(
  name: string,
  heading: GuideHeading,
  entries: readonly GuideEntry[],
): void {
  const app = document.getElementById('app');
  if (!app) throw new Error(`${name}: #app not found`);
  mountShell(app, renderGuide(entries, heading));
  registerServiceWorker();
  log.info('shell mounted', name);
}
