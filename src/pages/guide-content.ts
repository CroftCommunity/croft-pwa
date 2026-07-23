// The user guide as PURE DATA — no DOM, no network — so the copy is unit-tested
// and the same entries render identically in the browser (user-guide-view.ts)
// and in any other surface. This is the reusable Croft "user-guide generator":
// an ordered list of entries, each a sequence of typed blocks. A new PWA keeps
// the shape and replaces the content.
//
// Voice: explain what a thing is FOR, not just where its button sits. Screenshots
// (`shot` blocks) live in assets/guide/<name>.jpg and are regenerated from the
// running app by `npm run guide:shots` — rerun after any visual change so the
// guide never shows a UI that no longer exists (a unit test fails if a `shot`
// names a file that is not on disk).

export type GuideBlock =
  | { readonly kind: 'prose'; readonly text: string }
  | { readonly kind: 'steps'; readonly items: readonly string[] }
  | { readonly kind: 'note'; readonly text: string }
  | { readonly kind: 'shot'; readonly name: string; readonly alt: string; readonly caption: string };

export interface GuideEntry {
  /** Stable hook for tests and TOC anchors. */
  readonly testid: string;
  readonly title: string;
  /** Short label for the table of contents. */
  readonly toc: string;
  readonly blocks: readonly GuideBlock[];
}

export const GUIDE: readonly GuideEntry[] = [
  {
    testid: 'guide-shape',
    title: 'The shape: one repo, standards and a reference implementation',
    toc: 'The shape',
    blocks: [
      {
        kind: 'prose',
        text:
          'A Croft PWA is a static, backendless site: no server of its own, one ' +
          'HTML document per destination, no framework and no client router. ' +
          'This repo is both the standards for building one and a reference ' +
          'implementation that proves them — and the site you are reading is ' +
          'itself that reference. If a rule here cannot be shown by this repo ' +
          "passing its own checks, the rule is wrong.",
      },
      {
        kind: 'note',
        text:
          'The point of a static, dependency-free site is longevity and ' +
          'portability: it keeps working with nothing running behind it, and it ' +
          'moves to any host that can serve files.',
      },
    ],
  },
  {
    testid: 'guide-gate',
    title: 'One gate proves everything',
    toc: 'The gate',
    blocks: [
      {
        kind: 'prose',
        text:
          'There is a single command that runs every check, identical to what ' +
          'continuous integration runs. If it passes on a fresh checkout, the ' +
          'work is sound; a deploy is only done once the live site actually ' +
          'serves the build you pushed.',
      },
      {
        kind: 'steps',
        items: [
          'npm run test — lint, typecheck, unit, build, and end-to-end, in order.',
          'Each part also runs alone: npm run lint, npm run typecheck, npm run unit, npm run build, npm run e2e.',
          'Write the test first and watch it fail before you make it pass.',
        ],
      },
    ],
  },
  {
    testid: 'guide-chassis',
    title: 'The chassis: pages, tokens, and a service worker',
    toc: 'The chassis',
    blocks: [
      {
        kind: 'prose',
        text:
          'Every surface is its own page with its own small bundle, composed ' +
          'from a shared shell (a top bar, section tabs, and a build stamp). ' +
          'The build content-hashes each bundle, injects a strict Content ' +
          'Security Policy and Subresource Integrity, and generates a service ' +
          'worker so the site opens offline and picks up an update on the next ' +
          'visit.',
      },
      {
        kind: 'shot',
        name: 'home-light',
        alt: 'The croft-pwa home page in the light theme.',
        caption: 'The shared shell: wordmark, theme toggle, section tabs, and the build stamp in the footer.',
      },
    ],
  },
  {
    testid: 'guide-brand',
    title: 'Brand: colour lives in one place',
    toc: 'Brand',
    blocks: [
      {
        kind: 'prose',
        text:
          'All colour is defined once as named tokens; components and code never ' +
          'write a raw colour. Each text and interface pair is chosen to clear ' +
          'the accessibility contrast floor, and the ratio is recorded next to ' +
          'the token and checked automatically. Light and dark are the same ' +
          'palette re-tuned — the same stone wall, in daylight and at night.',
      },
      {
        kind: 'shot',
        name: 'home-dark',
        alt: 'The croft-pwa home page in the dark theme.',
        caption: 'Dark theme: the same tokens, re-tuned to hold contrast rather than a separate design.',
      },
    ],
  },
  {
    testid: 'guide-method',
    title: 'The working method: plans and run summaries',
    toc: 'Method',
    blocks: [
      {
        kind: 'prose',
        text:
          'Non-trivial work starts with a short dated plan that records the ' +
          'problem, the approach, and the reasoning — not just a list of ' +
          'changes. When the work is done, a run summary captures the evidence ' +
          'the checks passed, what was deliberately left out, and anything a ' +
          'test could not reach. Nothing is claimed that was not shown.',
      },
    ],
  },
  {
    testid: 'guide-start',
    title: 'Starting your own',
    toc: 'Start yours',
    blocks: [
      {
        kind: 'prose',
        text:
          'The chassis is the template. Copy the build, the tokens and styles, ' +
          'the shared shell and service worker, and the test setup; then replace ' +
          'the pages with your app and retune the palette, keeping colour in the ' +
          'one file and the contrast ratios recorded.',
      },
      {
        kind: 'note',
        text:
          'The integration with a personal data store (sign-in, reading and ' +
          'writing records) is a module that arrives in a later phase; until ' +
          'then, the two working Croft apps are the examples to read.',
      },
    ],
  },
];
