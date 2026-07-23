// Croft PWA build: bundle the TS app with esbuild, content-hash each entry,
// inject a build-time CSP + Subresource Integrity, generate a version-stamped
// service worker, and emit a self-contained static dist/ (skylite/arecipe
// pattern — no framework, no router). One command, mirrored by CI.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');

/** Build stamp: package version + short git SHA (falls back gracefully). */
function computeVersion() {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  let sha = 'nogit';
  try {
    sha = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: root }).toString().trim();
  } catch {
    // No git (e.g. tarball build) — leave the sentinel.
  }
  return `v0 ${pkg.version}+${sha}`;
}

const version = computeVersion();

// Pre-paint theme init: byte-identical across every page (injected via the
// %THEME_INIT% token, never hand-copied), so ONE CSP hash covers it. Keep this
// in sync with src/theme.ts resolveTheme(); the unit test pins the shared logic.
const THEME_INIT_JS =
  "(function(){try{var t=localStorage.getItem('croft-theme');" +
  "if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}" +
  "document.documentElement.setAttribute('data-theme',t);}catch(e){}})();";

function sha256base64(text) {
  return createHash('sha256').update(text, 'utf8').digest('base64');
}
function sriFor(bytes) {
  return 'sha384-' + createHash('sha384').update(bytes).digest('base64');
}

// Each destination: root HTML template, TS entry, and the template tokens for
// its hashed script src + SRI (page-per-destination shape).
const PAGES = [
  {
    html: 'index.html',
    entry: 'src/pages/index.ts',
    jsToken: '%INDEX_JS%',
    sriToken: '%INDEX_JS_SRI%',
  },
  {
    html: 'settings.html',
    entry: 'src/pages/settings.ts',
    jsToken: '%SETTINGS_JS%',
    sriToken: '%SETTINGS_JS_SRI%',
  },
  {
    html: 'user-guide.html',
    entry: 'src/pages/user-guide.ts',
    jsToken: '%GUIDE_JS%',
    sriToken: '%GUIDE_JS_SRI%',
  },
];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 1. Bundle the app entries; hashed filenames let the SW cache-bust safely.
const result = await esbuild.build({
  entryPoints: PAGES.map((p) => join(root, p.entry)),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  entryNames: 'assets/[name]-[hash]',
  outdir: dist,
  metafile: true,
  define: { __CROFT_VERSION__: JSON.stringify(version) },
});

function entryHref(srcEntry) {
  // esbuild records entryPoint repo-relative with forward slashes.
  const rel = srcEntry.split('\\').join('/');
  const outputs = result.metafile.outputs;
  const match = Object.keys(outputs).find(
    (o) => o.endsWith('.js') && outputs[o].entryPoint && outputs[o].entryPoint.endsWith(rel),
  );
  if (!match) throw new Error(`build: could not locate bundled entry for ${srcEntry}`);
  return '/' + match.replace(/^dist\//, '');
}
const pageHrefs = Object.fromEntries(PAGES.map((p) => [p.entry, entryHref(p.entry)]));

// 2. Served stylesheet = tokens.css (brand tokens, only place raw hex lives) then
// styles.css (components), concatenated so tokens resolve first in one request.
const stylesCss = `${readFileSync(join(root, 'tokens.css'), 'utf8')}\n${readFileSync(join(root, 'styles.css'), 'utf8')}`;
writeFileSync(join(dist, 'styles.css'), stylesCss);
const stylesSri = sriFor(Buffer.from(stylesCss, 'utf8'));
const stylesHref = `/styles.css?v=${encodeURIComponent(version)}`;

// 3. Copy static assets verbatim (assets/ holds the guide screenshots).
for (const asset of ['manifest.webmanifest', 'icons', 'assets', 'CNAME', 'LICENSE']) {
  const from = join(root, asset);
  if (existsSync(from)) cpSync(from, join(dist, asset), { recursive: true });
}
writeFileSync(join(dist, '.nojekyll'), '');

// 4. Precache manifest keyed to this exact build.
const precache = [
  '/',
  ...PAGES.map((p) => `/${p.html}`),
  '/manifest.webmanifest',
  '/icons/icon.svg',
  stylesHref,
  ...PAGES.map((p) => pageHrefs[p.entry]),
];

// 5. Generate the service worker (stable name, no hash — a SW URL must be
// stable). Bundle src/sw.ts with the precache list + cache name injected.
await esbuild.build({
  entryPoints: [join(root, 'src/sw.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
  outfile: join(dist, 'sw.js'),
  define: {
    __PRECACHE__: JSON.stringify(precache),
    __CACHE__: JSON.stringify(`croft-${version.replace(/[^\w.+-]/g, '_')}`),
  },
});

// 6. Per-page SRI for the hashed JS.
const jsSri = Object.fromEntries(
  PAGES.map((p) => {
    const file = join(dist, pageHrefs[p.entry].replace(/^\//, ''));
    return [p.entry, sriFor(readFileSync(file))];
  }),
);

// 7. Build-time CSP. default-src 'none' + explicit allowlists; the inline theme
// script is admitted by its sha256 (never 'unsafe-inline'). connect-src widens
// to the atproto origins when the PDA module lands (P3).
const csp = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  // NB: frame-ancestors is intentionally omitted — it is ignored in a <meta>
  // CSP (must be an HTTP header). The static host sets it; documented in
  // docs/SECURITY.md so a reviewer doesn't read the omission as a gap.
  "img-src 'self' data:",
  "font-src 'self'",
  "style-src 'self'",
  "manifest-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  `script-src 'self' 'sha256-${sha256base64(THEME_INIT_JS)}'`,
].join('; ');

// 8. Render each HTML page from its template, injecting everything above.
const themeInitTag = `<script>${THEME_INIT_JS}</script>`;
for (const p of PAGES) {
  const template = readFileSync(join(root, p.html), 'utf8');
  const html = template
    .replaceAll('%CSP%', csp)
    .replaceAll('%THEME_INIT%', themeInitTag)
    .replaceAll('%STYLES%', stylesHref)
    .replaceAll('%STYLES_SRI%', stylesSri)
    .replaceAll(p.jsToken, pageHrefs[p.entry])
    .replaceAll(p.sriToken, jsSri[p.entry]);
  writeFileSync(join(dist, p.html), html);
}

console.log(
  `built ${version} -> dist/  (${PAGES.length} pages, sw + precache ${precache.length}, CSP+SRI on)`,
);
