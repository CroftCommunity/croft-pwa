// Croft Bridge — content script (runs in the page's world, isolated from page JS).
//
// The only channel between the page and the extension: it relays a fetch request
// from the page to the background service worker and posts the result back. It is
// deliberately dumb — it holds no capability itself and makes no decision about
// what may be fetched; the background is the gate.
//
// Hardening: only same-window messages are accepted, and responses are posted
// back scoped to the page's own origin (never '*').
const ORIGIN = window.location.origin;

window.addEventListener('message', (ev) => {
  if (ev.source !== window) return; // ignore cross-frame / cross-window senders
  const d = ev.data;
  if (!d || d.__croftFetchRequest !== true || typeof d.url !== 'string') return;
  chrome.runtime.sendMessage({ kind: 'croft-fetch', url: d.url }, (result) => {
    window.postMessage({ __croftFetchResponse: true, id: d.id, result }, ORIGIN);
  });
});

// Announce presence so the page can tell the extension is installed and active.
window.postMessage({ __croftExtReady: true }, ORIGIN);
