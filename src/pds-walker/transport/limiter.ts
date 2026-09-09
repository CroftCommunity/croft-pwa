// The per-host limiter (plan 2026-09-08 § Phase 3c). The PDS rate limit is 3,000 requests
// per 5 minutes per HOST per IP (research § 3.1), and the walker fans out across dozens of
// hosts, so the cap is per host: never more than `perHost` in flight, and when a response
// says the budget is nearly spent (`RateLimit-Remaining` below 10) the host is paused until
// the `RateLimit-Reset` moment. Clock and sleep are injected so every test is deterministic.
import type { Logger } from '../core/rings.js';

/** What `pds.ts` needs: run a call under the cap, and let the limiter read the response's headers. */
export type Limiter = {
  run<T>(host: string, fn: () => Promise<T>): Promise<T>;
  observe(host: string, res: Response): void;
};

export type LimiterOptions = {
  readonly perHost?: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly log?: Logger;
  /** Pause when `RateLimit-Remaining` drops below this. */
  readonly threshold?: number;
};

const PAUSE_BELOW = 10;

/**
 * The library's default logger: the posture of `src/log.ts` without its browser switch —
 * `warn`/`error` reach the console tagged `[pds-walker]`, `debug`/`info` are silent. A
 * page passes its own `log` to get the `?debug=1` behaviour.
 */
export function defaultLogger(): Logger {
  const noop = (): void => undefined;
  return {
    debug: noop,
    info: noop,
    warn: (...args: unknown[]) => { console.warn('[pds-walker]', ...args); },
    error: (...args: unknown[]) => { console.error('[pds-walker]', ...args); },
  };
}

type HostState = { inFlight: number; pausedUntil: number; waiters: Array<() => void>; pausedLogged: boolean };

export function hostLimiter(opts: LimiterOptions = {}): Limiter {
  const perHost = opts.perHost ?? 4;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const log = opts.log ?? defaultLogger();
  const threshold = opts.threshold ?? PAUSE_BELOW;
  const hosts = new Map<string, HostState>();
  const stateOf = (host: string): HostState => {
    let s = hosts.get(host);
    if (s === undefined) { s = { inFlight: 0, pausedUntil: 0, waiters: [], pausedLogged: false }; hosts.set(host, s); }
    return s;
  };
  const wake = (s: HostState): void => { s.waiters.shift()?.(); };

  return {
    async run<T>(host: string, fn: () => Promise<T>): Promise<T> {
      const s = stateOf(host);
      while (s.inFlight >= perHost) await new Promise<void>((resolve) => s.waiters.push(resolve));
      while (s.pausedUntil > now()) await sleep(s.pausedUntil - now());
      if (s.pausedLogged) { s.pausedLogged = false; log.info('pds-walker: host resumed', host); }
      s.inFlight++;
      try {
        return await fn();
      } finally {
        s.inFlight--;
        wake(s);
      }
    },
    observe(host: string, res: Response): void {
      // Both headers, or nothing: `Number(null)` is 0, which would read a missing Remaining as
      // "budget spent" and a missing Reset as the epoch — the M2 test that caught it.
      const remainingRaw = res.headers.get('ratelimit-remaining');
      const resetRaw = res.headers.get('ratelimit-reset');
      if (remainingRaw === null || resetRaw === null) return;
      const remaining = Number(remainingRaw);
      const resetSeconds = Number(resetRaw);
      if (!Number.isFinite(remaining) || !Number.isFinite(resetSeconds)) return;
      if (remaining >= threshold) return;
      const s = stateOf(host);
      const until = resetSeconds * 1000;
      if (until <= s.pausedUntil) return;
      s.pausedUntil = until;
      if (!s.pausedLogged) {
        s.pausedLogged = true;
        log.warn('pds-walker: host paused', host, remaining, Math.max(0, Math.round((until - now()) / 1000)));
      }
    },
  };
}
