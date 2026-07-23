import { describe, it, expect } from 'vitest';
import { LocalStore, serialiseFlush, validateWirePayload } from '../../src/measure/store';

describe('LocalStore — the local/wire boundary', () => {
  it('records rich events locally and bumps counters', () => {
    const store = new LocalStore('s1', 'd1', 1000);
    store.record('page_home', { at: 1234, page: '/index.html' });
    store.record('page_home', { at: 1250, page: '/index.html' });
    const snap = store.snapshot();
    expect(snap.counts.page_home).toBe(2);
    expect(snap.events).toHaveLength(2);
    expect(snap.events[0]).toEqual({ name: 'page_home', at: 1234, page: '/index.html' });
    expect(snap.deviceId).toBe('d1');
  });

  it('seeds from persisted counts and events (survives page navigation)', () => {
    const store = new LocalStore('s2', 'd2', 1000, {
      counts: { page_home: 3 },
      events: [{ name: 'page_home', at: 1, page: '/index.html' }],
    });
    store.record('page_guide', { at: 2, page: '/user-guide.html' });
    const snap = store.snapshot();
    expect(snap.counts).toEqual({ page_home: 3, page_guide: 1 });
    expect(snap.events).toHaveLength(2);
  });

  it('serialiseFlush emits ONLY {v, period, counts} — no identity, ordering, or timestamps', () => {
    const store = new LocalStore('secret-session', 'secret-device', 1000);
    store.record('page_home', { at: 999, page: '/index.html' });
    const payload = serialiseFlush(store, '2026-07');
    expect(Object.keys(payload).sort()).toEqual(['counts', 'period', 'v']);
    expect(payload).toEqual({ v: 1, period: '2026-07', counts: { page_home: 1 } });
    expect(JSON.stringify(payload)).not.toContain('secret');
  });
});

describe('validateWirePayload — rejects anything beyond the declared shape', () => {
  const clean = { v: 1, period: '2026-07', counts: { page_home: 2 } } as const;

  it('accepts a clean monthly payload', () => {
    expect(validateWirePayload(clean, { periodGranularity: 'month' })).toEqual([]);
  });

  it('rejects a smuggled extra field', () => {
    const dirty = { ...clean, deviceId: 'x' } as unknown as typeof clean;
    const problems = validateWirePayload(dirty, { periodGranularity: 'month' });
    expect(problems.some((p) => p.includes('deviceId'))).toBe(true);
  });

  it('rejects a period finer than the declared bucket', () => {
    const daily = { ...clean, period: '2026-07-21' };
    expect(validateWirePayload(daily, { periodGranularity: 'month' }).length).toBeGreaterThan(0);
  });

  it('rejects non-integer or negative counts', () => {
    const bad = { ...clean, counts: { a: 1.5, b: -1 } };
    expect(validateWirePayload(bad, { periodGranularity: 'month' })).toHaveLength(2);
  });
});
