// Service-worker registration. Progressive enhancement: a failure is logged and
// swallowed, never breaks the app. `updateViaCache: 'none'` so sw.js itself is
// not HTTP-cached and a shipped update is seen on the next visit.
import { log } from './log';

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    // Relative so the scope is the deploy directory (works at a domain root or a
    // project subpath like /croft-pwa/).
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(
      (reg) => log.info('sw registered', reg.scope),
      (err) => log.warn('sw registration failed', err),
    );
  });
}
