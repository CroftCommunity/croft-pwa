# Accessibility — the workspace standard

**This file is canonical** for how every surface in the workspace is made and kept
accessible. croft-pwa is the home because it is the reference implementation (as for
`CI.md` and `WEB-TESTING.md`), not because the rules are croft-pwa's. The workspace
router table in `CroftC/.claude/CLAUDE.md` points here directly — there is no index
doc in between.

This standard was **extracted, not invented**: six repos independently arrived at
axe-in-both-themes, and the differences between their six versions are what the rules
below settle. Every rule names the incident that produced it, because a rule whose
reason is lost gets "simplified" away by the next session.

## The gate

Every repo that ships a web surface runs an **axe-core scan through Playwright** that
blocks on **serious and critical** violations, across **every page** and **every theme
or skin**.

- **Both themes, always.** Contrast is theme-dependent — a token pair that clears AA in
  light can fail in dark, and the light scan will never see it.
- **Serious/critical blocks; minor/moderate does not.** A gate that fires on cosmetic
  findings gets muted, and a muted gate is worse than none. Tighten only deliberately.
  *Recorded exception:* `fun` blocks on **all** violations because a game board is a
  small, fully-controlled DOM where the noise floor is genuinely zero — a stricter local
  bar is always allowed, a looser one needs a recorded reason.
- **Zero excluded rules by default.** An exclusion is an owner decision and carries its
  reasoning inline. forage's `link-in-text-block` exclusion is the model: it was
  excluded with a note that it failed on the default skin because the app set
  `a { text-decoration: none }` app-wide — then the owner made the call on 2026-08-26 to
  underline links in prose, the CSS changed, and the exclusion was **deleted**. An
  exclusion is a parked decision, not a permanent carve-out.

## Four soundness requirements, without which the gate is theatre

A green axe run only means something if it scanned the DOM a user actually gets. Each
of these was learned by a suite reporting green over a real defect.

**1. Hermetic — block cross-origin traffic.** A scan that is allowed to fetch live
atproto content renders a different DOM on a networked laptop than in CI, so the thing
CI blessed is not the thing you looked at. Block every non-localhost request and scan
the deterministic offline shell.

```js
await page.route('**/*', (route) => {
  const host = new URL(route.request().url()).hostname;
  if (host === 'localhost' || host === '127.0.0.1') void route.continue();
  else void route.abort();
});
```

**2. Scan the settled DOM, not the transitional one.** Where the shell is mounted by JS
after load, `waitUntil: 'load'` and even `'networkidle'` can catch a pre-render,
pre-theme page — axe then grades a screen no user sees, which produces both false reds
(transitional contrast) and false greens (chrome not yet present). Wait for a
shell-mounted element, then a brief settle.

```js
await page.goto(path, { waitUntil: 'load' });
await page.locator('footer').first().waitFor({ timeout: 8000 });
await page.waitForTimeout(600);
```

**3. Scan the population a first-time visitor gets.** *(forage, 2026-08-26.)* forage
scanned its memory-backed surfaces and called the suite clean; production defaults to
the Bluesky lens view at `/`, which the suite never loaded. A live scan after deploy
found a contrast failure there. **If the app has more than one population or backend
mode, the default one is not optional to scan.**

**4. The scope must match something.** *(fun, 2026-08-29.)* axe's two scoping calls
behave differently when their selector matches nothing, and only one of them tells you:

| | selector matches nothing |
|---|---|
| `.include(sel)` | **throws** — `No elements found for include in page Context` |
| `.exclude(sel)` | **silent** — scans everything, reports clean |

Measured, not assumed — the expectation going in was that both would be silent, and
`include` turning out to be loud is the whole reason the two need different treatment.

So a broken `include` dies on the first run, and a **stale `exclude` survives for as
long as nobody looks**. One did: `fun` excluded `iframe.wrapped-game-frame` from its
cross-skin matrix, and the last iframe left the shelf a day before anyone noticed the
exclusion was still there. It excluded nothing, reported exactly the same green, and
would have **silently widened** the moment an iframe returned — grading a live surface
as exempt under a rule written for something that no longer existed.

An exclusion is a claim that something is present *and* out of scope. The first half is
checkable, and it is the half that rots. **Assert the target exists, in the same spec,
or drop the exclusion.** `fun/tests/axe-scope.test.ts` enforces this by reading the
specs: it is deliberately vacuous while no exclusions exist, and fires the moment one is
added without proof.

This is a different rule from *"zero excluded rules by default"* above, and both are
needed: that one is about `disableRules` — muting a **check**; this one is about
`.exclude()` — muting a **region**. A muted region is the quieter of the two, because
nothing in the output distinguishes "excluded a real thing" from "excluded nothing".

Pages deliberately left out of the scan **must say why in the spec file**. Both
recorded exclusions are the same shape and both are legitimate: arecipe excludes its
data-heavy pages and bluebird excludes `index.html` because a hermetic load hits
offline/error chrome carrying contrast artifacts a user never sees. Their a11y belongs
to a stable-state harness or the feature specs. An undocumented omission is
indistinguishable from an oversight — that is the whole reason for the rule.

## Colour: the ratio is recorded, never inferred

Every colour token in `tokens.css` carries its **measured** contrast ratio in a comment
or the design doc, and no colour is introduced inline. The floors are the WCAG ones:
**4.5:1** for normal text, **3.0:1** for large/bold text and UI boundaries.

**Apply the floor to the ROLE, not to the token.** *(forage/phpbb, 2026-08-26.)* The
phpbb skin carried prosilver's band `#4688CE` at 3.70:1 under white. That legitimately
clears the 3.0 bar for large/bold UI — but the masthead nav links sitting on it are
normal 14px text, where 4.5 applies. The threshold was right; the role it was applied
to was wrong. A token's ratio is only meaningful against the role it is used in.

**A token test is not a contrast test.** *(forage, 2026-08-26 — 28 violations.)* The
unit suite checked the token pairs someone thought to enumerate. The browser renders
combinations nobody enumerated: muted text on an even row, a nav link on a filled band,
the wordmark on a coloured masthead. The rendered scan is the instrument; the token test
is a fast pre-filter, not a substitute. That run also caught a skin rendering its **dark**
palette while registered as light — the invariant skipped it *because* it was declared
light. The suite was green against the declaration, and the declaration was the thing
that was wrong.

## What axe cannot see — the manual floor

Automated scanning catches roughly the half of a11y that is machine-checkable. These
are required and are **not** covered by the gate:

- **Keyboard path.** Every interactive control reachable and operable by keyboard, in a
  sensible order, with no trap. Test the paths that matter in the feature specs.
- **Visible focus.** A 3px `--focus` outline everywhere, never removed without a
  replacement of at least equal visibility.
- **`prefers-reduced-motion`** collapses transitions and animations.
- **Live regions** for anything that changes without a navigation (toasts, inline
  reveals, call state) so a screen reader is told.
- **Touch targets ≥44px** — the geometry rule lives in `MOBILE-FIRST.md`, gated there,
  because it is measured the same way as layout fit.
- **Meaningful names on icon-only controls.** No unlabeled affordance.

## Non-web surfaces

Accessibility is not a web-only dimension, and the standard applies to any surface with
a user interface.

**`croft/android`** (Croft Call, one Compose screen, `ui/CallScreen.kt`) is currently
accessible **by construction rather than by intent**: every control is a text-labelled
`Button`/`TextButton`, so TalkBack has real names and Material 3 supplies its own
minimum touch targets. There is **no a11y gate and no a11y prose in croft** — the state
is good, but nothing holds it there, and the first icon-only button added will break it
silently. When the screen grows: `contentDescription` on every icon-only control,
`minimumInteractiveComponentSize` respected, and no hardcoded `sp` below 12 for content
text. Tracked as an open item; not gated today, and this paragraph is the honest record
of that.

## Maintenance

Audit **check 21** enforces the two mechanical parts: every web-UI repo has an axe gate
(FLAG), and its scan shows visible hermeticity (NOTE — advisory per `PATTERN.md`'s
escalation rule, because inferring "does this page fetch?" is unreliable: croft-pwa
resolves its PDS from a DID doc, so no host literal appears anywhere in its source).
Hermeticity is satisfied by any of four forms — blocking cross-origin, a harness fetch
shim, the spec stating its surface needs no network, or the repo declaring that once in
its own docs.

**Requirement 4 is not audit-enforced yet, deliberately.** The scope rule has one
executable guard, `fun/tests/axe-scope.test.ts`, in the repo where the incident happened.
It is recorded here because the *reasoning* is workspace-wide — the `include`/`exclude`
asymmetry is a property of axe, not of `fun` — but a workspace audit check should wait
until a second repo needs one. A check promoted on a single instance is how a rule
arrives without evidence, and this doc's whole premise is that every rule names the
incident that produced it. croft-pwa uses no `.exclude()` today, so it complies by
having nothing to comply with.

**The axe VERSION is part of the gate's definition.** A newer axe ships more rules, so
two repos on different axe versions are not scanning to the same standard and a gate can
be green only because its scanner is older. The pin is the lockfile, not the declared
range — `^4.12.1` resolves 4.13.0 quite happily, which is how greetings_site and pdsview
ended up off-standard while declaring the canonical version (2026-08-26). Check 15 reads
the resolved version; the canonical number lives in `WEB-TESTING.md` with the other
toolchain pins.

Check 21 cannot see the manual floor, the population rule, or whether an exclusion is
justified — those are **review, not script**, stated here so the gap is known rather than
assumed covered. Refine rule and why together, per `CroftC/.claude/PATTERN.md`.

*This file is Tier 3 and is pointed at DIRECTLY from the workspace router table in
`CroftC/.claude/CLAUDE.md`. It deliberately has no `.claude/` index doc: one existed
briefly and measured 85% restatement of this file, which is a second edition rather than
a route. An index earns its place only when it holds cross-repo state no single repo can
own (a compliance matrix, a version pin); explanation belongs here, once.*
