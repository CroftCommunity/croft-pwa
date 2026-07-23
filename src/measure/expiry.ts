// Pure date helpers for measurement: runtime expiry and the coarse period marker.
// Kept pure (dates passed in) so they are unit-tested deterministically; the app
// passes the real device clock.
import type { MetricMeta } from './registry';

/** A metric is active while its expiry has not passed. ISO dates compare as strings. */
export function isActive(meta: MetricMeta, today: string): boolean {
  return meta.expires >= today;
}

/** The coarse month bucket, e.g. "2026-07" — the only time info allowed on the wire. */
export function yearMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${y}-${m}`;
}

/** Today's date as YYYY-MM-DD (UTC), for expiry comparison. */
export function isoDay(date: Date): string {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const d = `${date.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}
