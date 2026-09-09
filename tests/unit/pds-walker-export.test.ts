import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The package boundary of croft-pwa/pds-walker (plan 2026-09-08 § Phase 1c, SHARED-CODE.md
// rule 2: the repo root is the package). Every later pds-walker-*.test.ts imports through the
// export path too, so each is an entry-point test; this file alone also proves the shipping
// boundary (`files`) with a dry-run pack.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('croft-pwa/pds-walker — the export path', () => {
  it('resolves through the package exports map and carries its own version clock', async () => {
    const m = (await import('croft-pwa/pds-walker')) as { VERSION: string };
    expect(m.VERSION).toBe('0.1.0');
  });

  it('loads in plain Node, unbundled — every emitted relative import resolves (M3 found extensionless imports)', () => {
    // vitest and esbuild resolve `./core/rings` without an extension; Node ESM and a browser
    // serving the files as-is do not. The emitted tree must carry `.js` on every relative
    // import, or a consumer without a bundler gets ERR_MODULE_NOT_FOUND.
    const out = execFileSync(process.execPath, ['--input-type=module', '-e',
      "const m = await import('croft-pwa/pds-walker'); if (typeof m.createWalker !== 'function' || typeof m.rings !== 'function') process.exit(2); console.log('ok');"],
      { cwd: root, encoding: 'utf8' });
    expect(out.trim()).toBe('ok');
  });

  it('packs only the built library plus package.json, README and LICENSE', () => {
    const out = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: root, encoding: 'utf8' });
    const parsed = JSON.parse(out) as Array<{ files: Array<{ path: string }> }>;
    const first = parsed[0];
    expect(first).toBeDefined();
    const paths = (first as { files: Array<{ path: string }> }).files.map((f) => f.path).sort();
    const allowedTop = new Set(['package.json', 'README.md', 'LICENSE']);
    const offenders = paths.filter((p) => !allowedTop.has(p) && !p.startsWith('lib/'));
    expect(offenders).toEqual([]);
    expect(paths).toContain('lib/pds-walker/index.js');
    expect(paths).toContain('lib/pds-walker/index.d.ts');
  });
});
