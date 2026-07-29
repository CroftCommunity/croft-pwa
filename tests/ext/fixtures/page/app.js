// Test-page probes used by the extension e2e specs (Phases 2–4/7). Mirrors the
// discovery spike's page: a direct fetch (expected CORS-blocked) and a fetch
// routed through the extension content-script bridge.
(() => {
  let extReady = false;
  window.addEventListener('message', (ev) => {
    if (ev.source === window && ev.data && ev.data.__croftExtReady) extReady = true;
  });
  window.__extReady = () => extReady;

  window.__directFetch = async (url) => {
    try {
      const res = await fetch(url);
      return { ok: true, status: res.status, body: await res.text() };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };

  window.__viaExtension = (url) =>
    new Promise((resolve) => {
      const id = String(performance.now()) + ':' + url;
      const timer = setTimeout(() => resolve({ ok: false, error: 'extension timeout' }), 5000);
      function handler(ev) {
        if (ev.source !== window) return;
        const d = ev.data;
        if (d && d.__croftFetchResponse && d.id === id) {
          clearTimeout(timer);
          window.removeEventListener('message', handler);
          resolve(d.result);
        }
      }
      window.addEventListener('message', handler);
      window.postMessage({ __croftFetchRequest: true, id, url }, '*');
    });
})();
