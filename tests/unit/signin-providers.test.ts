import { describe, it, expect } from 'vitest';
import {
  PROVIDERS,
  SIGNUP,
  ATMO_GLOSS,
  providerById,
  featuredProviders,
  otherProviders,
  canCreateAccount,
  validateProviders,
  type Provider,
} from '../../src/signin/providers';

// The sign-in sheet's provider registry — docs/DESIGN.md § Flows › Sign in.
// Lifted from forage (js/auth/hosts.js, 2026-08-26..29) where every fact was
// probed against the live network; the same facts are re-probed here by
// tests/live/signin-providers.live.spec.ts, so a posture that rots is noticed.

const open = (id: string): Provider => ({ id, label: id.toUpperCase(), entryway: `https://${id}.test`, signups: SIGNUP.OPEN });
const invite = (id: string): Provider => ({ id, label: id.toUpperCase(), entryway: `https://${id}.test`, signups: SIGNUP.INVITE });

describe('signin providers: the registry', () => {
  it('passes its own validation', () => {
    expect(() => validateProviders(PROVIDERS)).not.toThrow();
  });

  it('knows the probed postures: bsky, blacksky and eurosky OPEN; northsky INVITE', () => {
    const byEntry = Object.fromEntries(PROVIDERS.map((p) => [p.entryway, p.signups]));
    expect(byEntry['https://bsky.social']).toBe(SIGNUP.OPEN);
    expect(byEntry['https://blacksky.app']).toBe(SIGNUP.OPEN);
    expect(byEntry['https://eurosky.social']).toBe(SIGNUP.OPEN);
    expect(byEntry['https://northsky.social']).toBe(SIGNUP.INVITE);
  });

  it('names what it does not know, and what it does', () => {
    expect(() => providerById('nope')).toThrow(/nope.*bsky/);
    expect(providerById('eurosky').label).toBe('EuroSky');
  });

  it('carries the atmo gloss the sheet shows, verbatim (owner wording 2026-08-29)', () => {
    expect(ATMO_GLOSS).toBe('A Personal Data Server provider in the open social Atmosphere');
  });
});

describe('signin providers: two panels, split by posture', () => {
  // The front page is the providers a newcomer can JOIN from here; invite-only
  // providers sit on the "Another provider" panel with the handle field. Both
  // halves are asserted so a provider cannot fall out of both.
  it('featured = open (registry order, capped); other = invite-only', () => {
    const reg = [open('o1'), invite('i1'), open('o2')];
    expect(featuredProviders(reg).map((p) => p.id)).toEqual(['o1', 'o2']);
    expect(otherProviders(reg).map((p) => p.id)).toEqual(['i1']);
  });

  it('every registered provider is on exactly one panel', () => {
    const all = [...featuredProviders(), ...otherProviders()].map((p) => p.id).sort();
    expect(all).toEqual(PROVIDERS.map((p) => p.id).sort());
  });

  it('the featured list is capped at four', () => {
    const reg = ['a', 'b', 'c', 'd', 'e'].map(open);
    expect(featuredProviders(reg)).toHaveLength(4);
  });

  // BOTH directions: an invite-only provider still ADVERTISES prompt=create —
  // it would land on a create screen that then demands a code. Posture decides,
  // not the advertised capability.
  it('open providers offer account creation; invite-only ones do NOT', () => {
    expect(canCreateAccount(open('o'))).toBe(true);
    expect(canCreateAccount(invite('i'))).toBe(false);
  });
});

describe('signin providers: bad registry data fails loudly', () => {
  it('an unknown posture names the provider AND the value', () => {
    const bad = [{ id: 'x', label: 'X', entryway: 'https://x.test', signups: 'maybe' }] as unknown as readonly Provider[];
    expect(() => validateProviders(bad)).toThrow(/x.*maybe/);
  });

  it('a non-https entryway is refused', () => {
    expect(() => validateProviders([{ ...open('h'), entryway: 'http://h.test' }])).toThrow(/https/);
  });

  it('two ids on one entryway is a bug, not two providers', () => {
    expect(() => validateProviders([open('a'), { ...invite('b'), entryway: 'https://a.test' }])).toThrow(/a\.test/);
  });
});
