// The standards, as chapters — pure data rendered by the same generator as the
// user guide (user-guide-view.ts). Each chapter is a GuideEntry[]. The prose is
// distilled from docs/ (DESIGN, SECURITY, PRACTICES) and CLAUDE.md; the docs stay
// the long-form source, these are the live, in-site chapters.
import type { GuideEntry } from './guide-content';

export const CHASSIS: readonly GuideEntry[] = [
  {
    testid: 'chassis-pages',
    title: 'Pages, not a framework',
    toc: 'Pages',
    blocks: [
      {
        kind: 'prose',
        text:
          'Each destination is its own HTML document with its own small bundle. ' +
          'Navigation is real links between real documents, so the browser back ' +
          'button works and there is no client router to keep in sync. A shared ' +
          'shell (top bar, section tabs, build stamp) is mounted by one function ' +
          'so every page looks and behaves the same.',
      },
      {
        kind: 'note',
        text:
          'There is no framework and no runtime dependency. Everything is built ' +
          'on the platform; the only third-party code is the dev toolchain.',
      },
    ],
  },
  {
    testid: 'chassis-build',
    title: 'One build, one self-contained output',
    toc: 'Build',
    blocks: [
      {
        kind: 'prose',
        text:
          'A single build step bundles each page with a content-hashed name, ' +
          'concatenates the tokens and component styles into one stylesheet, ' +
          'injects the security policy and integrity hashes into every page, and ' +
          'generates the service worker. The result is a folder of static files ' +
          'that any file host can serve.',
      },
      {
        kind: 'steps',
        items: [
          'Hashed filenames mean an updated asset has a new URL — a stale copy is impossible.',
          'The build stamp (version plus commit) is shown in the footer and keyed into the service-worker cache.',
          'A deploy is done only when the live site serves the build you pushed, not when CI turns green.',
        ],
      },
      {
        kind: 'shot',
        name: 'home-light',
        alt: 'The home page showing the shared shell.',
        caption: 'The shared shell every page mounts: wordmark, theme toggle, tabs, build stamp.',
      },
    ],
  },
  {
    testid: 'chassis-paths',
    title: 'Relative paths, always',
    toc: 'Relative paths',
    blocks: [
      {
        kind: 'prose',
        text:
          'Every asset reference, navigation link, and the service worker use ' +
          'relative paths — never an absolute path from the domain root. This is ' +
          'what lets the exact same build run at a domain root or under a subpath, ' +
          'which is how a project page and the per-PR preview (served under a ' +
          '/pr-preview/ path) work. The build fails if a page emits an ' +
          'absolute-root path, and a test serves the site under a subpath to prove ' +
          'it holds.',
      },
    ],
  },
  {
    testid: 'chassis-sw',
    title: 'A service worker that never strands a fix',
    toc: 'Service worker',
    blocks: [
      {
        kind: 'prose',
        text:
          'The worker is generated per build with a precache list, so the site ' +
          'opens offline. Its routing decision is a small pure function tested on ' +
          'its own: navigations are served network-first so a shipped update is ' +
          'picked up on the next visit, content-hashed assets are served ' +
          'cache-first, and cross-origin requests are never intercepted.',
      },
    ],
  },
];

export const BRAND: readonly GuideEntry[] = [
  {
    testid: 'brand-tokens',
    title: 'Colour lives in one file',
    toc: 'Tokens',
    blocks: [
      {
        kind: 'prose',
        text:
          'All colour is defined once as named tokens. Components and code never ' +
          'write a raw colour value; they reference a token. A test enforces this, ' +
          'so a stray colour fails the build rather than drifting into the design.',
      },
      {
        kind: 'note',
        text:
          'The palette is a tuned variant of the Croft tectonic board — the warmth ' +
          'of a stone wall in the sun. A new colour is added to the token file with ' +
          'its purpose, not invented inline.',
      },
    ],
  },
  {
    testid: 'brand-contrast',
    title: 'Contrast is recorded and checked',
    toc: 'Contrast',
    blocks: [
      {
        kind: 'prose',
        text:
          'Every pairing of text or interface colour against its background is ' +
          'chosen to clear the accessibility contrast floor, and the measured ' +
          'ratio is written next to the token. A test recomputes those ratios for ' +
          'both themes, so a tweak that breaks a floor fails the gate.',
      },
      {
        kind: 'shot',
        name: 'home-dark',
        alt: 'The home page in the dark theme.',
        caption: 'Dark is the same palette re-tuned to hold contrast, not a separate design.',
      },
    ],
  },
  {
    testid: 'brand-theme',
    title: 'Two themes, no flash, no "auto"',
    toc: 'Theme',
    blocks: [
      {
        kind: 'prose',
        text:
          'Light and dark only. An explicit choice is remembered; otherwise the ' +
          'system preference is followed. The theme is resolved before the first ' +
          'paint by a tiny inline script, so there is no flash of the wrong theme. ' +
          'There is no "auto" state, because a toggle that matched the system read ' +
          'as doing nothing.',
      },
    ],
  },
];

export const PWA: readonly GuideEntry[] = [
  {
    testid: 'pwa-security',
    title: 'Security baked into the artifact',
    toc: 'Security',
    blocks: [
      {
        kind: 'prose',
        text:
          'A static site has no server to configure, so security is built in at ' +
          'build time. Every page carries a strict content policy that denies ' +
          'everything by default and opens only what the app needs; the single ' +
          'inline script is admitted by its hash, never by allowing inline code ' +
          'in general. The stylesheet and every script carry an integrity hash, ' +
          'so a tampered or mis-served file will not run.',
      },
      {
        kind: 'note',
        text:
          'A test loads every page under the policy and fails on any violation or ' +
          'any script loaded from another origin.',
      },
    ],
  },
  {
    testid: 'pwa-offline',
    title: 'Install and offline',
    toc: 'Offline',
    blocks: [
      {
        kind: 'prose',
        text:
          'A web manifest with a maskable icon makes the site installable to a ' +
          'home screen and gives it a standalone window. The service worker keeps ' +
          'the shell and assets available offline; a network-first policy for ' +
          'pages means an installed copy still updates when the network returns.',
      },
    ],
  },
  {
    testid: 'pwa-logging',
    title: 'The console is the debugger',
    toc: 'Logging',
    blocks: [
      {
        kind: 'prose',
        text:
          'With no backend, the browser console is where a problem is diagnosed. ' +
          'A small leveled logger tags its output; debug and info are gated behind ' +
          'a flag while warnings and errors always show. Every risky boundary logs ' +
          'through it, so a failure can be understood from the console alone.',
      },
    ],
  },
];

export const AGENT_METHOD: readonly GuideEntry[] = [
  {
    testid: 'method-tdd',
    title: 'Test first, always',
    toc: 'TDD',
    blocks: [
      {
        kind: 'prose',
        text:
          'No production code lands without a failing test that demanded it. Pure ' +
          'logic is unit-tested; page wiring is tested end-to-end against the built ' +
          'site. A behaviour change starts by rewriting the test that pinned the old ' +
          'behaviour. Watch the test fail before you make it pass.',
      },
    ],
  },
  {
    testid: 'method-plans',
    title: 'Plans record the why',
    toc: 'Plans',
    blocks: [
      {
        kind: 'prose',
        text:
          'Non-trivial work begins with a short dated plan that states the problem, ' +
          'the approach, and the reasoning — not just a list of changes. A future ' +
          'reader should be able to reconstruct why a change was made from the plan ' +
          'alone.',
      },
    ],
  },
  {
    testid: 'method-runs',
    title: 'Run summaries carry the evidence',
    toc: 'Run summaries',
    blocks: [
      {
        kind: 'prose',
        text:
          'When work is done, a run summary records what shipped, the checks that ' +
          'passed with their counts, what was deliberately left out and why, and a ' +
          'files-touched ledger. Anything a test could not reach is filed openly ' +
          'rather than quietly claimed.',
      },
      {
        kind: 'note',
        text:
          'Summaries are a historical record. They are not rewritten after the fact.',
      },
    ],
  },
  {
    testid: 'method-agents',
    title: 'Written for agents, overseen by a human',
    toc: 'Agents',
    blocks: [
      {
        kind: 'prose',
        text:
          'The operating manual, the agent guide, and a discovery index give a ' +
          'coding agent what it needs to work here or to build a new Croft PWA. The ' +
          'standards are enforced by tests, not by trust, so a human reviews ' +
          'outcomes rather than re-checking mechanics by hand.',
      },
    ],
  },
];
