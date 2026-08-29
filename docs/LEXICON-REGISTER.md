# The `ing.croft.croftpwa.*` register

croft-pwa defines one record type of its own. This file exists because minting an atproto
record type is cheap and permanent: a custom type that duplicates an official one is a fork
of the network wearing a namespace, and nothing breaks loudly when you do it.

Rule and its reasoning: `CroftC/.claude/LEXICONS.md`. Audit checks 41+42 require this file
and require every minted type to appear in it.

Every entry answers **Holds**, **Why ours**, and **Ecosystem check** — the last being which
existing types were actually opened and looked in.

Namespace: `ing.croft.*` is the reverse of **croft.ing**, which the project controls.
**Not yet published — and the reason is not what a first look suggests.** Measured
2026-08-29 against Porkbun's authoritative nameservers:

```
_lexicon.croft.ing      ->  CNAME pixie.porkbun.com.
_probe-xyz.croft.ing    ->  CNAME pixie.porkbun.com.     <- a name nobody created
```

The second line is the point: an invented name answers identically, so this is a
**wildcard** — the registrar's parking default answering every undefined name under
croft.ing — not a record sitting at `_lexicon`. A wildcard applies only where the queried
name has no records of its own (RFC 1034 §4.3.3), so creating an explicit
`_lexicon.croft.ing TXT` takes precedence and the parking answer stops applying there.
**Nothing needs deleting**, and deleting the wildcard would change how the whole zone
answers in order to fix one lookup. Until that TXT exists, nothing outside this app can
resolve `ing.croft.*`. See `CroftC/.claude/LEXICONS.md` § 2.

---

## ing.croft.croftpwa.note

**Holds:** `text` (≤3000 bytes / 300 graphemes) and `createdAt`, in the signed-in user's
own repo, at a TID key never derived from content.

**Why ours — and this is the unusual case on the page: it is not a data type at all.** It
exists to exercise the DPoP-bound write path end to end, and *because* it is ours it can be
written, read back and deleted against a real account without touching anything a person
would miss. A demo that wrote `app.bsky.feed.post` would put a real post on a real timeline
every time the write path was tested, which is the actual reason not to use the official
type here.

**Ecosystem check (2026-08-29):**

| Candidate | What it holds | Why it does not fit |
|---|---|---|
| `app.bsky.feed.post` | a real post, fanned out to followers and the AppView | shape is identical and that is deliberate ("mirrors a mainline post… so it stays portable"), but every exercise of the write path would publish to a live timeline |
| `com.atproto.repo.*` calls with no record type | — | not an option: a record must declare a `$type`, so exercising `createRecord` requires *some* collection |
| `app.bsky.actor.profile` | your own profile | a singleton, and overwriting it to test a write path is destructive |

**The justification is the test posture, not the data**, and that is worth stating plainly
because it is the kind of type that later gets "promoted" into a real feature by someone who
reads only its shape. If this ever carries user-meaningful notes, the ecosystem check must
be redone from scratch — at that point `app.bsky.feed.post` becomes a serious candidate
again, and the reasoning above stops applying.

**Retire-by condition.** This type has no users and no persistence requirement. If the DPoP
write path acquires a real end-to-end test against another collection, delete this one
rather than keeping a demo record type in a shipped namespace.

---

## Owed

- **Publish the namespace** (`CroftC/.claude/LEXICONS.md` § 2) — one TXT record at
  `_lexicon.croft.ing`, which takes precedence over the parking wildcard without removing
  it. Until it exists, no other client can resolve `ing.croft.*`. The worked example, verified
  2026-08-29: `_lexicon.recipe.exchange` → `did:plc:4cx7…` → four
  `com.atproto.lexicon.schema` records whose rkeys are the NSIDs. This is croft.ing-wide
  work — `ing.croft.*` is minted in at least four repos — and a demo type is a poor reason
  to do it alone.
