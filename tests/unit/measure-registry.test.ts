import { describe, it, expect } from 'vitest';
import { META, METRICS } from '../../src/measure/registry';
import { isActive, yearMonth, isoDay } from '../../src/measure/expiry';

describe('metric registry', () => {
  it('declares a plain-language disclosure and an expiry for every metric', () => {
    for (const [name, meta] of METRICS) {
      expect(meta.disclosure.trim().length, `disclosure for ${name}`).toBeGreaterThan(0);
      expect(meta.expires, `expires for ${name}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['page', 'feature', 'timing', 'edge']).toContain(meta.type);
    }
  });

  it('METRICS covers exactly the META keys', () => {
    expect(METRICS.map(([n]) => n).sort()).toEqual(Object.keys(META).sort());
  });
});

describe('runtime expiry and period bucket', () => {
  it('a metric is active until its expiry passes (string ISO compare)', () => {
    const meta = META.page_home;
    expect(isActive(meta, '2027-01-01')).toBe(true);
    expect(isActive(meta, meta.expires)).toBe(true); // active ON the expiry day
    expect(isActive(meta, '2099-01-01')).toBe(false);
  });

  it('yearMonth is the coarse month bucket', () => {
    expect(yearMonth(new Date('2026-07-21T13:00:00Z'))).toBe('2026-07');
    expect(yearMonth(new Date('2026-01-02T00:00:00Z'))).toBe('2026-01');
  });

  it('isoDay is YYYY-MM-DD (UTC)', () => {
    expect(isoDay(new Date('2026-07-09T23:59:59Z'))).toBe('2026-07-09');
  });
});
