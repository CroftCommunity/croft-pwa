// Ambient types for the probes the e2e test page (fixtures/page/app.js) attaches
// to `window`. Lets the strict typecheck see them inside `page.evaluate(...)`.
export {};

interface BridgeResult {
  readonly ok: boolean;
  readonly status?: number;
  readonly body?: string;
  readonly error?: string;
  readonly refused?: boolean;
}

declare global {
  interface Window {
    __extReady: () => boolean;
    __directFetch: (url: string) => Promise<BridgeResult>;
    __viaExtension: (url: string) => Promise<BridgeResult>;
  }
}
