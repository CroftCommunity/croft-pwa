import { describe, it, expect, vi } from 'vitest';
import { detectBridge, fetchVia, type BridgeTransport } from '../../src/reader/bridge';

// A controllable fake of the page<->extension channel. Captures what the client
// sends and lets the test push a reply, so the protocol logic is tested without
// a browser or a real extension.
function fakeTransport(): {
  transport: BridgeTransport;
  sent: Record<string, unknown>[];
  reply: (data: Record<string, unknown>) => void;
} {
  const sent: Record<string, unknown>[] = [];
  const handlers = new Set<(data: Record<string, unknown>) => void>();
  return {
    sent,
    reply: (data) => handlers.forEach((h) => h(data)),
    transport: {
      send: (message) => sent.push(message),
      subscribe: (handler) => {
        handlers.add(handler);
        return () => handlers.delete(handler);
      },
    },
  };
}

describe('fetchVia', () => {
  it('resolves ok with status and body when the extension delivers', async () => {
    const f = fakeTransport();
    const p = fetchVia(f.transport, 'https://atproto.com/rss.xml', { timeoutMs: 1000 });
    const req = f.sent[0];
    expect(req?.__croftFetchRequest).toBe(true);
    expect(req?.url).toBe('https://atproto.com/rss.xml');
    f.reply({ __croftFetchResponse: true, id: req?.id, result: { ok: true, status: 200, body: '<rss/>' } });
    await expect(p).resolves.toEqual({ kind: 'ok', status: 200, body: '<rss/>' });
  });

  it('resolves not-approved when the extension refuses the origin', async () => {
    const f = fakeTransport();
    const p = fetchVia(f.transport, 'https://x.com/f', { timeoutMs: 1000 });
    f.reply({ __croftFetchResponse: true, id: f.sent[0]?.id, result: { ok: false, refused: true, error: 'nope' } });
    await expect(p).resolves.toEqual({ kind: 'not-approved' });
  });

  it('resolves error for a non-refusal failure (e.g. network)', async () => {
    const f = fakeTransport();
    const p = fetchVia(f.transport, 'https://x.com/f', { timeoutMs: 1000 });
    f.reply({ __croftFetchResponse: true, id: f.sent[0]?.id, result: { ok: false, error: 'Failed to fetch' } });
    await expect(p).resolves.toEqual({ kind: 'error', message: 'Failed to fetch' });
  });

  it('resolves not-installed when no response arrives before the timeout', async () => {
    vi.useFakeTimers();
    const f = fakeTransport();
    const p = fetchVia(f.transport, 'https://x.com/f', { timeoutMs: 500 });
    await vi.advanceTimersByTimeAsync(600);
    await expect(p).resolves.toEqual({ kind: 'not-installed' });
    vi.useRealTimers();
  });

  it('ignores a response whose id does not match the request', async () => {
    vi.useFakeTimers();
    const f = fakeTransport();
    const p = fetchVia(f.transport, 'https://x.com/f', { timeoutMs: 500 });
    f.reply({ __croftFetchResponse: true, id: 'some-other-id', result: { ok: true, status: 200, body: 'x' } });
    await vi.advanceTimersByTimeAsync(600);
    await expect(p).resolves.toEqual({ kind: 'not-installed' });
    vi.useRealTimers();
  });
});

describe('detectBridge', () => {
  it('resolves true when the extension announces readiness', async () => {
    const f = fakeTransport();
    const p = detectBridge(f.transport, { timeoutMs: 1000 });
    expect(f.sent[0]?.__croftPing).toBe(true);
    f.reply({ __croftExtReady: true });
    await expect(p).resolves.toBe(true);
  });

  it('resolves false when the extension does not answer before the timeout', async () => {
    vi.useFakeTimers();
    const f = fakeTransport();
    const p = detectBridge(f.transport, { timeoutMs: 500 });
    await vi.advanceTimersByTimeAsync(600);
    await expect(p).resolves.toBe(false);
    vi.useRealTimers();
  });
});
