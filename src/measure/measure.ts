// App integration for usage measurement. This is the glue the pages call. It
// keeps the rich local store, persists it across page navigations (each page is
// its own document, so counts live in localStorage), records typed metrics with
// runtime expiry, and flushes on the page-lifecycle events — logging the exact
// wire payload "as if" a remote were receiving it (no endpoint is configured, so
// nothing actually leaves; the console log and the Metrics page are the view).
//
// The privacy boundary lives in store.ts: only serialiseFlush's output can leave,
// and it is validated before it would go.
import { META, type MetricName } from './registry';
import {
  LocalStore,
  serialiseFlush,
  validateWirePayload,
  type LocalEvent,
  type LocalSnapshot,
  type WirePayload,
} from './store';
import { isActive, isoDay, yearMonth } from './expiry';
import { getConsent } from './consent';

const TAG = '[croft-measure]';
const DEVICE_KEY = 'croft-measure-device';
const SESSION_KEY = 'croft-measure-session';
const STATE_KEY = 'croft-measure-state';
const LASTFLUSH_KEY = 'croft-measure-lastflush';
const MAX_EVENTS = 50;

export interface LastFlush {
  readonly at: number;
  readonly period: string;
  readonly transmitted: boolean;
  readonly problems: string[];
  readonly payload: WirePayload;
}

interface PersistedState {
  readonly period: string;
  readonly counts: Record<string, number>;
  readonly events: LocalEvent[];
}

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage denied — measurement degrades to in-memory for this page */
  }
}

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for a non-secure context: not cryptographically strong, and that is
    // fine — this id never leaves the device.
    return `dev-${Math.floor(Math.random() * 1e9).toString(36)}`;
  }
}

function loadState(period: string): PersistedState {
  const raw = readLS(STATE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PersistedState;
      // A new period resets the counters (the bucket the wire payload reports).
      if (parsed.period === period) return parsed;
    } catch {
      /* corrupt — fall through to a fresh state */
    }
  }
  return { period, counts: {}, events: [] };
}

function deviceId(): string {
  let id = readLS(DEVICE_KEY);
  if (!id) {
    id = randomId();
    writeLS(DEVICE_KEY, id);
  }
  return id;
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

const now = new Date();
const today = isoDay(now);
const period = yearMonth(now);
const startedAt = now.getTime();

const seed = loadState(period);
const store = new LocalStore(sessionId(), deviceId(), startedAt, {
  counts: seed.counts,
  events: seed.events,
});

function persist(): void {
  const snap = store.snapshot();
  const state: PersistedState = {
    period,
    counts: snap.counts,
    events: snap.events.slice(-MAX_EVENTS),
  };
  writeLS(STATE_KEY, JSON.stringify(state));
}

function buildFlush(): { payload: WirePayload; problems: string[] } {
  const payload = serialiseFlush(store, period);
  const problems = validateWirePayload(payload, { periodGranularity: 'month' });
  return { payload, problems };
}

function logFlush(userInitiated: boolean): LastFlush {
  const { payload, problems } = buildFlush();
  const transmitted = getConsent();
  if (problems.length > 0) {
    console.error(`${TAG} flush blocked — payload invalid`, problems, payload);
  } else if (transmitted) {
    // As if a remote were receiving. No endpoint is configured, so this is the
    // only trace: the exact bag of counts and the coarse period, nothing else.
    console.info(`${TAG} flush → (no remote configured; logged only)`, payload);
  } else if (userInitiated) {
    console.info(`${TAG} sharing is off — nothing sent. This is what a flush WOULD send:`, payload);
  } else {
    console.debug(`${TAG} flush held (sharing off); would send:`, payload);
  }
  const last: LastFlush = { at: now.getTime(), period, transmitted, problems, payload };
  writeLS(LASTFLUSH_KEY, JSON.stringify(last));
  return last;
}

let lifecycleWired = false;
function wireLifecycle(): void {
  if (lifecycleWired || typeof document === 'undefined') return;
  lifecycleWired = true;
  // Flush when the page is backgrounded or being put away — bfcache-safe (no
  // unload/beforeunload, which break the back/forward cache).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') logFlush(false);
  });
  window.addEventListener('pagehide', () => logFlush(false));
}

export const measure = {
  /** Record one declared metric. Undeclared (compile error) or expired names are dropped. */
  record(name: MetricName): void {
    const meta = META[name];
    if (!isActive(meta, today)) {
      console.debug(`${TAG} not recording expired metric`, name);
      return;
    }
    store.record(name, { at: now.getTime(), page: location.pathname });
    persist();
  },
  /** The rich local view — for the Metrics page. Never transmitted. */
  snapshot(): LocalSnapshot {
    return store.snapshot();
  },
  /** The exact payload a flush would send, plus any schema problems. */
  wirePreview(): { payload: WirePayload; problems: string[] } {
    return buildFlush();
  },
  /** User-initiated flush (Metrics page button). Always logs so it is visible. */
  flushNow(): LastFlush {
    return logFlush(true);
  },
  lastFlush(): LastFlush | null {
    const raw = readLS(LASTFLUSH_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LastFlush;
    } catch {
      return null;
    }
  },
  period,
  today,
};

wireLifecycle();
