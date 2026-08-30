# Design — the workspace standard

**This file is canonical** for how Croft web surfaces look, what they are built from, how
their flows are shaped, and what words they use. croft-pwa is the home because it is the
reference implementation (as for `CI.md`, `WEB-TESTING.md`, `ACCESSIBILITY.md`,
`MOBILE-FIRST.md`): every rule below is proved by this repo's own code passing its gate,
and a rule this repo cannot demonstrate is wrong. Routed to from the workspace router
table in `CroftC/.claude/CLAUDE.md` via the index `CroftC/.claude/DESIGN.md`.

It grew (2026-08-29, owner) from the brand doc it used to be into a **standard dimension
with four categories**, because three sibling dimensions already governed pieces of design
— layout (`MOBILE-FIRST.md`), accessibility (`ACCESSIBILITY.md`), theming
(`CroftC/.claude/SKINS.md`) — and the piece with no home was the one that had just been
built four different ways across four repos: the sign-in surface (see § "What is not met
yet"). This doc does not restate those three; it names where each category's rules live.

```
Foundations   tokens · type · spacing · motion · theme      (here)  + layout → MOBILE-FIRST
                                                                     + a11y   → ACCESSIBILITY
                                                                     + skins  → SKINS
Components    navigation law · sheet · row · buttons · empty states  (here)
Flows         sign in / create account                                (here; first entry)
Copy          the nouns, the atmo gloss, tone                         (here)
```

**The rule for growing it:** a pattern joins this doc when it exists in two repos or is
about to — and it joins with its reference implementation and its test, or it is a wish,
not a standard. (`CroftC/.claude/PATTERN.md` step 5: a rule with no check decays into
prose.)

---

## Foundations

### Colour: raw hex lives only in `tokens.css`

Components and app code reference semantic tokens through `var()`. A new colour is added
to `tokens.css` with a recorded contrast ratio — never invented inline. Both rules are
enforced by tests (`brand-nohex`, `brand-tokens`), so a regression fails the gate.

The brand is a PWA-UI-tuned variant of the Croft **tectonic** palette (the warmth of a
stone wall in the sun, not a wellness app). Source of intent:
`discovery/beta/socialization/visual-identity-and-the-progressive-depth-website.md`.
Values are re-tuned so every text/UI pair clears WCAG AA; the tokens are the source of
truth, this doc is the *why*.

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

Dark theme ("the same stone wall at night") re-tunes each token to clear the same floors;
the ratios are recorded inline in `tokens.css` and asserted for both themes. `--border` is
a decorative hairline and carries no text/UI contrast requirement.

### Type, spacing, motion

- **Display**: Lora (titles, wordmark — never body). **Body/UI**: Inter. **Machine facts**
  (build stamp, status, DIDs, anything software produced): `ui-monospace`.
- **Type scale** is a fixed ramp (`--t-stamp` … `--t-wordmark`); new sizes join the ramp,
  never ad-hoc.
- **Spacing** is a 4px base (`--s-1` … `--s-7`); all padding/margin/gap comes from it.
  Radii `--r-s/m/l/pill`; one stroke width `--stroke` (1.5px).
- Focus is visible everywhere: a 3px `--focus` outline. `prefers-reduced-motion` collapses
  transitions.

### Theme resolution (no flash, no "auto")

An explicit stored choice wins; otherwise the OS preference. Two states only — light and
dark. A one-tap toggle that happened to match the system read as a no-op (real user
feedback carried from arecipe), so there is no "auto" state. Resolution runs pre-paint as
an inline `<head>` script (admitted by its CSP hash) so there is no flash; `src/theme.ts`
owns the toggle after load and keeps `<meta name="theme-color">` in sync with
`--theme-color`. The pure resolver is unit-tested (`tests/unit/theme.test.ts`).

Where a repo has **skins**, light and dark are registry entries inside a skin, not this
second axis — `CroftC/.claude/SKINS.md` governs and this section yields to it.

### Layout and accessibility

Not restated. `MOBILE-FIRST.md` (320/360/390, the 44px tap floor, the unfalsifiable
`scrollWidth` trap) and `ACCESSIBILITY.md` (hermetic axe, every page × every theme) are
sibling dimensions, both canonical here in croft-pwa.

---

## Components

### Navigation law: pages, not modals — with one recorded exception

Every surface is its own document; navigation is real links (native back button). No
client router, no focus-trapping overlays — only inline reveals and transient toasts.
Mobile-first, single column below 40rem; tabs move to a thumb-reachable bottom bar on
phones. Touch targets ≥44px (WCAG 2.5.5 — the workspace floor; `MOBILE-FIRST.md`).

**The exception (2026-08-29, owner): a native `<dialog>` sheet for a choose-one step that
returns you where you were.** Choosing a sign-in provider is not a destination; making it
a page would send the person away from the thing they were about to do and hand them a
back button to get home. The sheet is admitted on three conditions, each of which is why
"native" is in the rule:

1. It is a **native `<dialog>` opened with `showModal()`**, never a hand-rolled div. Probed
   under a harness (forage, 2026-08-27) rather than assumed: the element supplies focus
   entry, Esc, focus return to the trigger, and background inertness with no code, and axe
   can see inside an open one — proved by planting an unnamed button in the probe, because
   a clean scan would have proved nothing. Modals are precisely where hand-rolling fails,
   and every one of those behaviours is a thing a keyboard visitor needs and a sighted
   mouse user never notices missing.
2. It is **built fresh per open and removed on close.** A lingering singleton carries a
   half-typed field from one visit into the next.
3. It **carries its own fit and a11y checks** — a modal is invisible to a page-level gate
   that never summons it (`tests/e2e/signin-sheet.spec.ts` measures the open sheet at
   320px and scans it with axe in both themes for exactly this reason).

### Sheet

Bottom sheet on a phone (full width, rounded top corners, `max-height: 92dvh`, scrolls
inside); a centred dialog gets the extra room at ≥40rem. The backdrop is `--ink` at 55%.
Reference: `dialog.signin-sheet` in `styles.css`, `src/signin/sheet.ts`. A sheet has a
heading (`aria-labelledby`), an intro sentence, a list of rows, and at most one
progressive-disclosure step (a button that hides itself and reveals a panel).

### Row

A label on the left, an action group on the right (`flex: none`, so the label wraps and
the buttons do not). Rows are separated by `--stroke` hairlines. **A missing action leaves
its words in the slot**, so the column stays aligned down the list and the italic reads as
the explanation for the button that is not there (see the invite-only rule below).

### Buttons

`.btn` + `.btn-primary` (accent fill: the one thing to do), `.btn-secondary` (outline:
the alternative), `.btn-danger`; `.btn-sm` tightens padding for rows but **never drops
below the 44px floor** — the floor is on `.btn`, not on the size. Two buttons that lead to
the same page wearing different words are one button; the sign-in flow below records the
evidence that its two are not.

### Empty states

Invitations with a next step (a dashed panel), never a blank box.

---

## Flows

### Sign in / create account — "Choose your atmo provider"

The first pattern in this doc, and the reason the doc has a Flows section: by 2026-08-29
four repos had built it four ways (see § "What is not met yet"). Lifted from forage
(`js/auth/hosts.js`, `js/ui/lens-views.js` `authSheet()`, plan
`forage/plans/2026-08-26-3-plan-signed-out-front-door.md`) into this repo as the
reference: `src/signin/providers.{json,ts}`, `src/signin/sheet.ts`, wired on
`atproto.html`; proved by `tests/unit/signin-providers.test.ts`,
`tests/e2e/signin-sheet.spec.ts`, and `tests/live/signin-providers.live.spec.ts`.

**The narrative.** Alice taps *Sign in or create an account*. A sheet asks her to choose
her **atmo provider** and shows the ones she could join right now — Bluesky, Blacksky,
EuroSky — each with *Create account* and *Sign in*. She is a Northsky member, so she taps
*Another provider*: Northsky appears (*invite only*, *Sign in*) above a field for a handle
on any server at all. She taps Sign in; OAuth starts at `northsky.social`; she comes back
signed in, and the app learns her DID from the token.

**The rules, each with its why:**

1. **A provider registry, every fact probed.** `signups` (open / invite) comes from
   `com.atproto.server.describeServer → inviteCodeRequired`; OAuth support from
   `/.well-known/oauth-authorization-server`; `prompt=create` from
   `prompt_values_supported`. *Why probed:* the first guesses were wrong three times
   (`blacksky.community`, `eurosky.tech`, `mu.social` — a Mastodon server), and each is
   recorded in `providers.ts` so it is not re-proposed. **A live drift check re-probes the
   registry** (`tests/live/…`), because hardcoded facts about someone else's service rot
   silently, and probing four third-party servers on the front door to avoid that would be
   a bad trade.
2. **Two panels, split by posture — not by position in a list.** The front page is the
   providers a newcomer can *join from here* (open signups, capped at four). Invite-only
   providers sit behind *Another provider*, above the handle field, still with *Sign in*.
   Both panels are derived from one registry, so a provider that changes posture moves
   panels in one edit and cannot fall off both. *Why the split (owner, 2026-08-29):* the
   first screen should only offer things a first-timer can do; a member of an invite-only
   server knows what they are looking for and finds it one tap in.
3. **Create is offered only where signups are open — both directions.** An invite-only
   provider still *advertises* `prompt=create`; offering it would land the person on a
   screen that then demands a code. So posture decides, not the advertised capability, and
   the words *invite only* sit **in the create slot** (Components › Row). The test asserts
   both directions, because a test of the open case alone passes while the invite case
   renders a button.
4. **Create and Sign in are two intents, not two words.** *Create account* sends
   `prompt=create` in the PAR; *Sign in* sends no prompt. The reference proves this by
   capturing the PAR body in the e2e — driven end to end against the open providers, it
   lands in the registration wizard rather than the sign-in screen. Without that evidence
   the two buttons would be two routes to one page.
5. **A provider start is server-first: no handle, no `login_hint`, DID from the token.**
   The person picked a server, not an identity; discovery runs from the entryway, and
   `completeAuthorization` takes the DID from the token's `sub` and resolves the person's
   *real* PDS, which need not be the entryway they chose (an entryway fronts a fleet).
   A token with no subject and no DID resolved up front is refused, not accepted
   anonymously.
6. **The handle field is the seam, and the list is an editorial convenience.** Everything
   not on the short list reaches the same code path by handle (leading `@` stripped). This
   is what keeps a curated list from becoming a boundary.
7. **The build allowlists the registry.** A `<meta>` CSP cannot allowlist arbitrary PDS
   hosts (`ATPROTO.md` § CSP) — but the registered providers are static, so `build.mjs`
   reads `providers.json` and adds each entryway to `connect-src`. Each is its own
   authorization server (probed 2026-08-29; the live spec re-checks), so discovery, PAR and
   token all stay inside the allowlist. The e2e mocks discovery *at each entryway* so a
   provider the build forgot fails with a CSP refusal in CI, not silently on a phone. *Why
   JSON:* one source for two consumers; a second list in the build would be the one that
   drifts. **Known limit:** a handle whose PDS is neither a registered provider nor a
   `*.host.bsky.network` host is still refused by the CSP on this repo — the read demo goes
   through the AppView for that reason; an app that must sign in from arbitrary hosts
   needs a header-level CSP.
8. **Silence is success.** After a provider tap the page says *Starting sign-in…* and then
   leaves; the only failure copy is *Could not start sign-in: <reason>*. The sheet closes
   itself; nothing else changes until the callback returns.

**What a repo needs to adopt it** (the pattern is the contract, not the code — forage
implements it in plain ESM, this repo in TypeScript):

- a registry with `{ id, label, entryway, signups }` rows, validated loudly, probed, with
  a live drift check;
- `featured = open, capped` / `other = invite-only` derived from that registry;
- a native `<dialog>` sheet built per open, with the title, gloss and intro below
  (§ Copy), rows per Components › Row, the two-direction create rule, the handle seam;
- an e2e that asserts both panels, the PAR intent, the 320px fit and an axe scan of the
  *open* sheet in every theme;
- and, for a CSP-bearing repo, `connect-src` derived from the registry.

---

## Copy

### The nouns

- **"atmo provider"** is where an account lives. Not *server* (true, but says nothing),
  not *PDS* (an acronym a first-timer cannot expand), not *Bluesky* (one provider of
  many — naming it as the category is the misunderstanding the sheet exists to correct).
  Owner wording, 2026-08-29. Retired phrasings, all harvested from live repos that day:
  *Sign in with your PDS*, *Choose your server*, *Another server*, *any atproto server*,
  *Sign in with Bluesky*, *your Bluesky handle*. The workspace audit (check 45) flags them.
- **The gloss, verbatim:** *"A Personal Data Server provider in the open social
  Atmosphere."* It is exported as `ATMO_GLOSS` and asserted by test, so the definition
  cannot drift between repos.
- **Bluesky is named as an example, never as the category:** *"Bluesky is one of many,
  and each sets its own rules."*

### The gloss is a tooltip AND a sentence

*atmo* in the title carries a native `<abbr title>` — it hovers on a desktop and
assistive tech reads it — but touch cannot hover, so the intro sentence repeats the
definition in plain sight. The tooltip is a bonus, not the only copy of the definition; a
test asserts the definition is visible without hovering.

### Tone

Plain sentences, no exclamation marks, the action in the button's own words (*Create
account*, *Sign in*, *Continue*, *Another provider*). A missing control gets an
explanation in its slot (*invite only*), not a disabled button. Protocol vocabulary
(PKCE, PAR, DPoP) belongs in explainer prose on this meta-site and nowhere a person is
trying to get something done.

---

## The gate

What proves this doc, in this repo: `brand-nohex` + `brand-tokens` (Foundations),
`tests/unit/theme.test.ts`, `tests/unit/signin-providers.test.ts` (registry, split,
two-direction create), `tests/e2e/signin-sheet.spec.ts` (sheet closed-until-asked, the
title and gloss, both panels, 320px fit + 44px, axe on the OPEN sheet in both themes, PAR
intent per provider — which is also the CSP proof), `tests/e2e/atproto.spec.ts` (the
handle path through to a completed token exchange), `tests/live/signin-providers.live.spec.ts`
(posture, OAuth, `create`, scope, and authorization-server drift; local only). Workspace:
`CroftC/.claude/bin/workspace-audit.sh` check 45 (copy nouns, registry presence), proved
RED on four harvested fixtures by `bin/test-signin-copy.sh`.

## What is not met yet — recorded, not accommodated

Surveyed 2026-08-29 across every repo with a sign-in surface (`CroftC/.claude/PATTERN.md`
step 1: prescribe, and write the gap down where it is):

| Repo | Container | Provider choice | Create | Noun today | Meets § Flows › Sign in |
|---|---|---|---|---|---|
| **croft-pwa** (this) | native `<dialog>` sheet on `atproto.html` | registry (4) + handle | yes (`prompt=create`) | atmo provider | **yes** — reference |
| **forage** | native `<dialog>` sheet + sidebar card + masthead one-tap | registry (`js/auth/hosts.js`, 4) + handle | yes | atmo provider (PR #15; two "atproto server" sentences outside the sheet fixed there) | yes, once #15 lands |
| **bluebird** | inline form on `patrol.html` + feed banner | handle only (`your handle, e.g. you.bsky.social`) | no | *Sign in with Bluesky*, *Your Bluesky handle*, *PDS host (optional)* | **no** — noun, no registry, no create |
| **arecipe** | dedicated `signin.html` page | handle only | no | *Sign in with your Bluesky handle* | **no** — noun, no registry, no create (page container is a legitimate variant; the sheet is an exception, not a mandate) |
| **greetings_site** | inline form on the create view | handle only (`you.bsky.social`) | no | *Sign in with your Bluesky handle to make a card*, label *Bluesky handle* | **no** — noun, no registry, no create. Not in the survey at all; check 45 found it on its first run, which is the argument for a check over a survey |
| fun | — | — | — | — | n/a (no accounts) |
| connect | — (web resolver only) | — | — | — | n/a |

The gaps in bluebird, arecipe and greetings_site are real and stand unweakened; each
carries a TODO in its own repo citing this section, and check 45 will keep saying so until
the copy changes. `discovery` is skipped by the check by name: it is thinking, proofs and
spikes, and the hit there was an unpacked seed bundle nobody ships.
