// Croft Bridge — background service worker.
//
// It performs the cross-origin reads the page cannot: the extension holds the
// host permissions, so its fetch is not subject to the page's same-origin
// policy. The page never makes the cross-origin (or insecure) request itself —
// that is what sidesteps the mixed-content / Private Network Access surface a
// local proxy would incur.
//
// Consent, not a blanket bridge: a fetch is served only for an origin the user
// has APPROVED, and approval is a real browser permission — the extension asks
// `chrome.permissions.contains` before every fetch. Feed origins are declared
// `optional_host_permissions` and granted at runtime from the options page
// (chrome.permissions.request); the local dev origin (http://localhost/*) is a
// static host_permission. This makes "consent" a browser-enforced property, not
// a JS list. (The interactive grant prompt is native UI — see docs; the refusal
// branch and a permitted origin are what the e2e exercises.)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.kind !== 'croft-fetch' || typeof msg.url !== 'string') return false;
  (async () => {
    let origin;
    try {
      origin = new URL(msg.url).origin;
    } catch {
      sendResponse({ ok: false, error: 'invalid url' });
      return;
    }
    const granted = await chrome.permissions.contains({ origins: [`${origin}/*`] });
    if (!granted) {
      sendResponse({ ok: false, refused: true, error: `origin not approved: ${origin}` });
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
