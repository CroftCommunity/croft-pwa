# Telemetry posture

Croft telemetry is **counter-based and privacy-preserving**: accountability to a
trusted human and honest product signal, never surveillance. croft-pwa is the
testbed where the design (from arecipe's `measure-proof` proof-of-concept) is
trialled before it lands in other Croft apps. The live surface is the
**Metrics** page; the mechanics live in `src/measure/`.

## The shape

- **One registry** (`src/measure/registry.ts`) is the single source of truth.
  Each metric declares its `type`, an engineer `description`, an `expires` date,
  and a plain-language `disclosure` shown to the user. `MetricName` is derived
  from the registry keys, so emitting an undeclared metric is a compile error.
- **A rich local store** (`src/measure/store.ts`) holds ordered events, fine
  timestamps, and the device's own session/device id. All of it is readable by
  the user on the Metrics page; **none of it is ever transmitted.**
- **One flush shape** can leave the device: `serialiseFlush` produces exactly
  `{ v, period, counts }` — an unordered bag of counter-name → integer plus a
  coarse month. It reads only the counter bag, so it cannot leak ordering,
  timestamps, or identity even by accident. `validateWirePayload` rejects any
  extra field, non-integer count, or a period finer than the declared bucket.
- **Runtime expiry** (`src/measure/expiry.ts`): the client honors each metric's
  `expires` from the bundled registry, with no server contact — a stale cached
  build retires a metric on its own once the clock passes the date.
- **Opt-in/out** (`src/measure/consent.ts`): local counting is always on and
  always shown; the consent toggle governs only whether a flush would transmit.
  Default is off — nothing is shared until the user opts in.

## What "trialled here" means (this phase)

No remote is configured. The full pipeline runs — counting, the lifecycle flush
on `visibilitychange`/`pagehide` (bfcache-safe), serialisation, and validation —
but a flush only **logs the exact payload to the console** as if a remote were
receiving it. The Metrics page shows the registry with disclosures, the current
local counts, recent local-only events, and the precise wire payload a flush
would send. Standing up a real receiver (endpoint + storage + consent-gated
`sendBeacon`) is a later, explicit step.

## Verified by the gate

- Unit: the local/wire boundary (`serialiseFlush` emits only the declared shape;
  identity never appears in the payload), `validateWirePayload` rejects smuggled
  fields / fine periods / bad counts, runtime expiry, and the registry's
  disclosure/expiry completeness.
- e2e: the Metrics page shows counts and the wire preview, consent is opt-in and
  persists, and a flush writes to the console while **no request leaves the
  origin**.

## Difference from arecipe's proof

arecipe's `measure-proof` uses a YAML registry with a generator and ships the
re-linkage attack analysis, synthetic corpus, flow reconstruction, and infra
math that validated the design. croft-pwa extracts the **product core** only,
with the registry as a typed TS module (no codegen) for a smaller, less brittle
surface. The privacy boundary, disclosure, expiry, and consent behaviour match.
