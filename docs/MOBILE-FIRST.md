# Mobile-first — the workspace standard

**This file is canonical** for how web surfaces lay out and behave on a phone. croft-pwa
is the home because it is the reference implementation (as for `CI.md`,
`WEB-TESTING.md`, `ACCESSIBILITY.md`). Routed to directly from the workspace router table in `CroftC/.claude/CLAUDE.md`.

The premise, which is not negotiable and is the reason this is a dimension rather than a
preference: **a phone is the common case, not a follow-up.** Design and gate for the
narrow viewport first; the desktop layout is the one that gets the extra room.

`fun/docs/RESPONSIVE-DESIGN.md` is the elaboration for **game/play surfaces**
(centred play column, d-pad centreline, gesture `touch-action`, the drawer/scrim
pattern) and keeps its own lessons log. It is downstream of this file, not a rival to
it: where both speak, this one governs.

## The gate

Every repo that ships a web surface runs a **no-horizontal-overflow check at 320, 360
and 390 px** across its pages, plus **tap-target assertions** on representative
controls.

**Why those three widths:** 320 = small Android / older iPhone (the width that actually
breaks things), 360 = the common Android, 390 = the modern iPhone. They are not
arbitrary — 320 is the floor worth supporting and the other two are where most real
traffic sits. Testing only 390 finds almost nothing.

**Tolerance is ≤1px.** Sub-pixel rounding produces a 0.5px "overflow" that means
nothing; a real bleed is tens of pixels. `expect(overflow).toBeLessThanOrEqual(1)`.

## Measuring overflow: the trap that makes the check unfalsifiable

The obvious check is `documentElement.scrollWidth > clientWidth`. **It is unsound in any
repo whose CSS sets `overflow-x: hidden` or `overflow-x: clip` on `html` or `body`.**
The clip is usually added deliberately as a safety net so users never see a horizontal
scrollbar — and it works, which is exactly the problem: with the overflow clipped, the
document's `scrollWidth` can no longer exceed `clientWidth`, so the assertion **can
never fail**. It reports green over any bleed at all.

*Recorded: bluebird, `styles.css:31` sets `overflow-x: clip` as that safety net, and its
Android "text overrun" bug — nowrap toggle labels widening whole cards past the viewport
— was invisible to a scrollWidth check.* bluebird is the only repo that measures real
element geometry, and it is the only repo that had to.

**The rule:** if `html`/`body` carries `overflow-x: hidden|clip`, the mobile check
**must** measure per-element geometry, not document scrollWidth.

```js
// Elements whose right edge crosses the viewport, regardless of any clip above them.
const bleeders = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  return Array.from(document.querySelectorAll('body *'))
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.right > vw + 1; })
    .map((el) => `${el.tagName.toLowerCase()} right=${Math.round(el.getBoundingClientRect().right)}px`);
});
expect(bleeders).toEqual([]);
```

Without a clip, `scrollWidth` is a sound and much cheaper check — keep it. The choice is
determined by the CSS, not by taste, which is what audit check 22 verifies.

## Provoke the failure — fixtures, not hope

An overflow check against tame content passes forever and proves nothing. The classic
culprits are **long unbroken tokens** (a 130-char word, a long URL with no break
opportunity), **long handles**, **deep nesting** (a reply chain indenting past the
edge), and **rigid elements** (a wide table, a `nowrap` row, a fixed-width control).
forage's `mobile-fit.workflow.mjs` is the model: its fixtures are *built* to provoke
exactly those, with a repeated `Supercalifragilisticexpialidocious`, a never-breaking
URL, and an 8-deep reply chain. Copy the shape, not just the assertion.

## Touch targets: ≥44×44 CSS px

**The floor is 44** — WCAG 2.5.5. Assert the **padded hit area** on representative
controls (icon-only ones especially: the fix is padding, not a bigger glyph), including
one control per chrome region — toolbar, bottom nav, icon button, segmented control.

**The inline exception is part of the criterion, not a loophole.** WCAG 2.5.5 exempts a
target that is *"in a sentence or block of text"* — a link inside a paragraph or a footer
line cannot be padded to 44px without breaking the text flow it lives in. A gate that
ignores this fails on ordinary prose links, and a gate that fails on correct markup gets
loosened or muted, which costs more than it ever caught. *Recorded: pdsview's first run
of this check flagged its two footer links (55×22, 122×22) — the check was wrong, not the
footer (2026-08-26).* Implement the exemption rather than working around it:

```js
// An <a> sitting inline in a text flow is exempt; a standalone control is not.
const inlineInText = (el) =>
  el.tagName === 'A' &&
  (el.parentElement?.textContent ?? '').trim().length > (el.textContent ?? '').trim().length;
```

Buttons, icon buttons and nav links whose anchor is the sole content of its container are
**not** exempt — they are standalone targets and the floor applies. Inline links stay a
manual-review judgement: exempt from the gate is not the same as comfortable to tap.

*Recorded, because this is a corrected drift:* croft-pwa's and view's design docs said
"≥40px" while arecipe's and fun's **tests** asserted 44. 40 corresponds to no WCAG
success criterion — it was a house number that spread by copying prose. The owner
settled it at 44 on 2026-08-26, aligning the prose to what the tests already enforced.
For reference, WCAG 2.2 AA (2.5.8) sets a 24×24 floor; **we hold the AAA 44 bar**
because these are thumb-first surfaces.

## Layout rules

- **Single column below 40rem.** Stack; do not shrink a multi-column layout.
- **Primary navigation is thumb-reachable on phones** — tabs move to a bottom bar. The
  top of a 6-inch screen is not reachable one-handed.
- **`touch-action: manipulation`** on tappable controls, to drop the ~300ms tap delay
  and double-tap-zoom. On a surface that reads swipes as input (a game board), the
  swipe-reading surface uses `touch-action: none` so a swipe is a move, not a scroll.
- **Text wraps; containers do not widen.** Long content must wrap or break
  (`overflow-wrap: anywhere` on user-supplied strings) rather than push its container.
- **Centre inline-level content via a wrapper.** `margin-inline: auto` does **not**
  centre an `inline-flex`/`inline-block` element — the auto margins collapse to zero.
  This has bitten twice in `fun` (2048, then match-3). Use a flex column with
  `align-items: center`, or `width: fit-content` on a block-level element.
- **Overlays close two ways beyond ESC:** an in-panel close button and a click-off
  scrim, and the scrim is **dimmed** — on a phone the panel eats most of the width, so
  an undimmed tap-off strip is invisible and users cannot tell it exists.

## Verification is a real browser, always

jsdom has no layout engine: centring, overflow and hit-area are **not** testable in
vitest, and a unit test that appears to check them is checking nothing. Playwright
`boundingBox()` and viewport sizing are the instruments. Run the a11y scan again after
any layout change — a new wrapper, a scrim, or a moved control can introduce a contrast
or landmark regression that the layout test cannot see.

## Maintenance

Audit **check 22** enforces the mechanical parts: every web-UI repo has a mobile-fit
gate; a repo with `overflow-x: hidden|clip` on `html`/`body` does not rely on a
scrollWidth check; and no doc cites a tap-target floor other than 44. Layout quality,
thumb reach and fixture provocation are review, not script — stated so the gap is known.

**The tap-floor number has exactly one home: this file.** Change it here, then the audit
script's `TAP_FLOOR` constant, then repo prose — the audit is what makes any other copy
detectable. (An earlier draft said the number lived both here and in a `.claude/` index,
which is two homes and therefore no home; that index is gone.) Refine rule and why
together, per `CroftC/.claude/PATTERN.md`.

*This file is Tier 3 and is pointed at DIRECTLY from the workspace router table in
`CroftC/.claude/CLAUDE.md`. It deliberately has no `.claude/` index doc: one existed
briefly and measured 86% restatement of this file — the worst compression ratio in the
funnel, because prose this paraphrasable invites a summary that becomes a second copy.
An index earns its place only when it holds cross-repo state no single repo can own.*
