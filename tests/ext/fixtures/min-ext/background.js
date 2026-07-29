// Minimal MV3 background service worker. Its only job is to exist so the harness
// can confirm the extension loaded and its service worker registered.
self.addEventListener('install', () => {
  // No-op; presence of a registered SW is what the harness spec asserts.
});
