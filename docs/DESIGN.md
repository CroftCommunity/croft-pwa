# Design & brand

The brand is a PWA-UI-tuned variant of the Croft **tectonic** palette (the
warmth of a stone wall in the sun, not a wellness app). Source of intent:
`discovery/beta/socialization/visual-identity-and-the-progressive-depth-website.md`.
Values here are re-tuned so every text/UI pair clears WCAG AA; the tokens are
the source of truth (`tokens.css`), this doc is the *why*.

## The rule that matters

**Raw hex lives only in `tokens.css`.** Components and app code reference
semantic tokens through `var()`. A new colour is added to `tokens.css` with a
recorded contrast ratio — never invented inline. Both rules are enforced by
tests (`brand-nohex`, `brand-tokens`), so a regression fails the gate.

## Palette (light theme; dark re-tunes the same roles)

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `--bg` | `#f3efe7` | page background (lightened Oatmeal) | — |
| `--surface` | `#e7dfd2` | cards, raised surfaces (Oatmeal Canvas) | — |
| `--ink` | `#1c1e20` | primary text (Iron Ore Black) | 14.58:1 on bg |
| `--ink-muted` | `#585b5c` | captions, mono machine facts | 5.97:1 on bg |
| `--accent` | `#ab5330` | primary action fill (Ruddy Orange, tuned) | 4.90:1 w/ `--accent-ink` |
| `--active` | `#3d6546` | active/success fill (Dark Moss) | 6.25:1 w/ `--active-ink` |
| `--link` | `#9b4423` | body-text links (darkened ruddy) | 5.64:1 on bg |
| `--danger` | `#9b3016` | warning + destructive (rust, not a 2nd accent) | 6.95:1 w/ `--danger-ink` |
| `--border` | `#b9ae9c` | hairline dividers — decorative, non-text | (exempt) |
| `--focus` | `#3d6546` | focus ring (moss) | 5.82:1 on bg |

Dark theme ("the same stone wall at night") re-tunes each token to clear the
same floors; the ratios are recorded inline in `tokens.css` and asserted for
both themes. `--border` is a decorative hairline and carries no text/UI contrast
requirement.

## Type, spacing, motion

- **Display**: Lora (titles, wordmark — never body). **Body/UI**: Inter. **Machine
  facts** (build stamp, status, DIDs, anything software produced): `ui-monospace`.
- **Type scale** is a fixed ramp (`--t-stamp` … `--t-wordmark`); new sizes join
  the ramp, never ad-hoc.
- **Spacing** is a 4px base (`--s-1` … `--s-7`); all padding/margin/gap comes
  from it. Radii `--r-s/m/l/pill`; one stroke width `--stroke` (1.5px).
- Focus is visible everywhere: a 3px `--focus` outline. `prefers-reduced-motion`
  collapses transitions.

## Theme resolution (no flash, no "auto")

An explicit stored choice wins; otherwise the OS preference. Two states only —
light and dark. A one-tap toggle that happened to match the system read as a
no-op (real user feedback carried from arecipe), so there is no "auto" state.
Resolution runs pre-paint as an inline `<head>` script (admitted by its CSP
hash) so there is no flash; `src/theme.ts` owns the toggle after load and keeps
`<meta name="theme-color">` in sync with `--theme-color`. The pure resolver is
unit-tested (`tests/unit/theme.test.ts`).

## Navigation law

**Pages, not modals.** Every surface is its own document; navigation is real
links (native back button). No client router, no focus-trapping overlays — only
inline reveals and transient toasts. Mobile-first, single column below 40rem;
tabs move to a thumb-reachable bottom bar on phones. Touch targets ≥40px.
Empty states are invitations with a next step (a dashed panel), never a blank box.
