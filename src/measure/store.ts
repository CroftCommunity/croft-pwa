// The privacy boundary, in code (ported from arecipe's measure-proof). The LOCAL
// store is rich: ordered events, fine timestamps, the device's own session and
// device identity — all readable by the user on the Metrics page, none of it ever
// transmitted. The FLUSH serialiser is the only path off the device, and it can
// produce exactly one shape: an unordered bag of counter-name → integer plus a
// coarse period marker. The boundary is enforced by the serialiser's
// construction, not by reviewer discipline.

export interface LocalEvent {
  readonly name: string;
  /** Fine ms timestamp — local only. */
  readonly at: number;
  /** Page label — local only. */
  readonly page: string;
}

export interface LocalSnapshot {
  readonly sessionId: string;
  readonly deviceId: string;
  readonly startedAt: number;
  readonly events: LocalEvent[];
  readonly counts: Record<string, number>;
}

export interface LocalSeed {
  readonly counts?: Record<string, number>;
  readonly events?: readonly LocalEvent[];
}

export class LocalStore {
  readonly #sessionId: string;
  readonly #deviceId: string;
  readonly #startedAt: number;
  readonly #events: LocalEvent[] = [];
  readonly #counts = new Map<string, number>();

  constructor(sessionId: string, deviceId: string, startedAt: number, seed?: LocalSeed) {
    this.#sessionId = sessionId;
    this.#deviceId = deviceId;
    this.#startedAt = startedAt;
    if (seed?.counts) for (const [k, v] of Object.entries(seed.counts)) this.#counts.set(k, v);
    if (seed?.events) this.#events.push(...seed.events.map((e) => ({ ...e })));
  }

  /** Record one event: appends the rich local event AND bumps the counter. */
  record(name: string, opts: { at: number; page: string }): void {
    this.#events.push({ name, at: opts.at, page: opts.page });
    this.#counts.set(name, (this.#counts.get(name) ?? 0) + 1);
  }

  /** The rich local view — for the user's own eyes. Never transmitted. */
  snapshot(): LocalSnapshot {
    return {
      sessionId: this.#sessionId,
      deviceId: this.#deviceId,
      startedAt: this.#startedAt,
      events: this.#events.map((e) => ({ ...e })),
      counts: Object.fromEntries(this.#counts),
    };
  }

  /** The ONLY data the serialiser is allowed to read. */
  countsOnly(): Record<string, number> {
    return Object.fromEntries(this.#counts);
  }
}

/** The wire payload — the complete, exhaustive shape that may leave the device. */
export interface WirePayload {
  readonly v: 1;
  /** Coarse period marker, e.g. "2026-07" (month) — the only time info on the wire. */
  readonly period: string;
  /** Unordered map of counter name → non-negative integer. */
  readonly counts: Record<string, number>;
}

/**
 * Serialise a flush. By construction it reads ONLY the counter bag and the coarse
 * period — it has no access to ordering, timestamps, or identity, so it cannot
 * leak them even by accident.
 */
export function serialiseFlush(store: LocalStore, period: string): WirePayload {
  return { v: 1, period, counts: store.countsOnly() };
}

const GRANULARITY_RE: Record<string, RegExp> = {
  month: /^\d{4}-\d{2}$/,
  week: /^\d{4}-W\d{2}$/,
  day: /^\d{4}-\d{2}-\d{2}$/,
};

/**
 * Validate a wire payload against the declared schema. Returns a list of problems
 * (empty = clean). Rejects any extra field (smuggled ordering, identity, or fine
 * timestamps), non-integer counts, and a period finer than the declared bucket.
 */
export function validateWirePayload(
  payload: WirePayload,
  opts: { periodGranularity: 'month' | 'week' | 'day' },
): string[] {
  const problems: string[] = [];
  const allowed = new Set(['v', 'period', 'counts']);
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) problems.push(`unexpected field on wire: \`${key}\``);
  }
  if (payload.v !== 1) problems.push('missing/invalid schema version `v`');
  const re = GRANULARITY_RE[opts.periodGranularity];
  if (!re || typeof payload.period !== 'string' || !re.test(payload.period)) {
    problems.push(`period must match the ${opts.periodGranularity} bucket`);
  }
  if (typeof payload.counts !== 'object' || payload.counts === null) {
    problems.push('counts must be an object');
  } else {
    for (const [name, v] of Object.entries(payload.counts)) {
      if (!Number.isInteger(v) || v < 0) {
        problems.push(`count \`${name}\` must be a non-negative integer, got ${v}`);
      }
    }
  }
  return problems;
}
