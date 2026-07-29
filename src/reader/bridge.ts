// The reader's client for the Croft Bridge extension. Pure protocol logic over a
// small transport seam, so it is unit-tested without a browser. The reader page
// builds a real transport from `window` (see `windowTransport`); the content
// script (extension/content.js) is the other end.
//
// Wire protocol (must match extension/content.js):
//   detect:  page → { __croftPing: true }         ; ext → { __croftExtReady: true }
//   fetch:   page → { __croftFetchRequest, id, url }; ext → { __croftFetchResponse, id, result }
// where `result` is the background's reply: { ok, status, body } | { ok:false, refused:true } |
// { ok:false, error }.

/** The outcome of a bridged fetch, as the reader needs to branch on it. */
export type BridgeResult =
  | { readonly kind: 'ok'; readonly status: number; readonly body: string }
  | { readonly kind: 'not-installed' }
  | { readonly kind: 'not-approved' }
  | { readonly kind: 'error'; readonly message: string };

/** The page↔extension channel, abstracted so the client is testable. */
export interface BridgeTransport {
  /** Send a message to the extension (page → content script). */
  send(message: Record<string, unknown>): void;
  /** Subscribe to messages from the extension; returns an unsubscribe function. */
  subscribe(handler: (data: Record<string, unknown>) => void): () => void;
}

interface BridgeOptions {
  readonly timeoutMs?: number;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `croft-${counter}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/** Ask whether the Croft Bridge extension is present. Resolves false on timeout. */
export function detectBridge(transport: BridgeTransport, options: BridgeOptions = {}): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? 2000;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);
    const unsubscribe = transport.subscribe((data) => {
      if (data['__croftExtReady'] === true) {
        clearTimeout(timer);
        unsubscribe();
        resolve(true);
      }
    });
    transport.send({ __croftPing: true });
  });
}

/** Fetch `url` through the extension. Never rejects — every outcome is a BridgeResult. */
export function fetchVia(transport: BridgeTransport, url: string, options: BridgeOptions = {}): Promise<BridgeResult> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const id = nextId();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve({ kind: 'not-installed' });
    }, timeoutMs);
    const unsubscribe = transport.subscribe((data) => {
      if (data['__croftFetchResponse'] !== true || data['id'] !== id) return;
      clearTimeout(timer);
      unsubscribe();
      const result = asRecord(data['result']);
      if (result === null) {
        resolve({ kind: 'error', message: 'malformed bridge response' });
        return;
      }
      if (result['ok'] === true) {
        const status = typeof result['status'] === 'number' ? result['status'] : 0;
        const body = typeof result['body'] === 'string' ? result['body'] : '';
        resolve({ kind: 'ok', status, body });
        return;
      }
      if (result['refused'] === true) {
        resolve({ kind: 'not-approved' });
        return;
      }
      const error = result['error'];
      resolve({ kind: 'error', message: typeof error === 'string' ? error : 'bridge fetch failed' });
    });
    transport.send({ __croftFetchRequest: true, id, url });
  });
}

/** Build a transport from a real browser Window (used by the reader page). */
export function windowTransport(win: Window): BridgeTransport {
  return {
    send: (message) => {
      win.postMessage(message, win.location.origin);
    },
    subscribe: (handler) => {
      const listener = (ev: MessageEvent): void => {
        if (ev.source !== win) return;
        const data = asRecord(ev.data);
        if (data !== null) handler(data);
      };
      win.addEventListener('message', listener);
      return () => {
        win.removeEventListener('message', listener);
      };
    },
  };
}
