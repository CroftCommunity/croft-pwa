// Croft Bridge — background service worker.
//
// It performs the cross-origin reads the page cannot: the extension holds the
// host permissions, so its fetch is not subject to the page's same-origin
// policy. The page never makes the cross-origin (or insecure) request itself —
// that is what sidesteps the mixed-content / Private Network Access surface a
// local proxy would incur.
//
// Consent, not a blanket bridge: a fetch is served only for an APPROVED host.
// In Phase 3 the approval is a static host allowlist (below) that mirrors the
// static host_permissions in the manifest. Phase 4 replaces both with runtime
// user consent (optional_host_permissions + chrome.permissions), leaving this
// gate's shape unchanged.
const APPROVED_HOSTS = new Set([
  'localhost', // the e2e reader origin (host_permissions: http://localhost/*)
  'atproto.com',
  'docs.bsky.app',
  'bsky.app',
]);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.kind !== 'croft-fetch' || typeof msg.url !== 'string') return false;
  (async () => {
    let host;
    try {
      host = new URL(msg.url).hostname;
    } catch {
      sendResponse({ ok: false, error: 'invalid url' });
      return;
    }
    if (!APPROVED_HOSTS.has(host)) {
      sendResponse({ ok: false, refused: true, error: `origin not approved: ${host}` });
      return;
    }
    try {
      const res = await fetch(msg.url);
      const body = await res.text();
      sendResponse({ ok: true, status: res.status, body });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; // keep the message channel open for the async sendResponse
});
