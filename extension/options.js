// Croft Bridge options: the per-source consent surface. Each row reflects whether
// the extension currently holds the host permission for that source, and lets the
// user grant it (chrome.permissions.request — a native prompt) or revoke it
// (chrome.permissions.remove). The background's fetch gate reads the same
// permission state via chrome.permissions.contains, so this page IS the allowlist.
const SOURCES = [
  { origin: 'https://atproto.com/*', title: 'AT Protocol Blog', host: 'atproto.com' },
  { origin: 'https://docs.bsky.app/*', title: 'Bluesky docs blog', host: 'docs.bsky.app' },
  { origin: 'https://bsky.app/*', title: 'Bluesky profiles', host: 'bsky.app' },
];

async function has(origin) {
  return chrome.permissions.contains({ origins: [origin] });
}

function render(list) {
  list.replaceChildren();
  for (const src of SOURCES) {
    const li = document.createElement('li');

    const label = document.createElement('div');
    const title = document.createElement('div');
    title.textContent = src.title;
    const host = document.createElement('div');
    host.className = 'host sub';
    host.textContent = src.host;
    label.append(title, host);

    const btn = document.createElement('button');
    const paint = async () => {
      const on = await has(src.origin);
      btn.textContent = on ? 'Revoke' : 'Approve';
      title.className = on ? 'on' : '';
    };
    btn.addEventListener('click', async () => {
      const on = await has(src.origin);
      if (on) {
        await chrome.permissions.remove({ origins: [src.origin] });
      } else {
        // Must be called from the user-gesture handler (the click) to show the prompt.
        await chrome.permissions.request({ origins: [src.origin] });
      }
      await paint();
    });

    li.append(label, btn);
    list.append(li);
    void paint();
  }
}

const list = document.getElementById('sources');
if (list) render(list);
