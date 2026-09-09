// The IndexedDB store (plan 2026-09-08 § Phase 4b): the same `Store` seam over the browser's
// database, one object store keyed by `did`. Everything crosses IndexedDB as a structured
// clone, so reads are copies by construction. Proven in a real browser by
// tests/e2e/pds-walker-store.spec.ts — a fake in Node would test the fake.
import type { Did, RepoSnapshot } from '../core/rings.js';
import type { Store } from './memory.js';

const STORE = 'snapshots';

function open(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'did' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB.open failed'));
  });
}
function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
}
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

/** A `Store` over IndexedDB database `name`. Opened lazily on first use; `put` keeps the newer of two. */
export function indexedDbStore(name: string): Store {
  let db: Promise<IDBDatabase> | undefined;
  const database = (): Promise<IDBDatabase> => (db ??= open(name));
  return {
    async get(did: Did): Promise<RepoSnapshot | null> {
      const tx = (await database()).transaction(STORE, 'readonly');
      const row = await request<RepoSnapshot | undefined>(tx.objectStore(STORE).get(did) as IDBRequest<RepoSnapshot | undefined>);
      return row ?? null;
    },
    async put(snapshot: RepoSnapshot): Promise<void> {
      const tx = (await database()).transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const have = await request<RepoSnapshot | undefined>(store.get(snapshot.did) as IDBRequest<RepoSnapshot | undefined>);
      if (have === undefined || snapshot.fetchedAt >= have.fetchedAt) store.put(snapshot);
      await done(tx);
    },
    async all(): Promise<RepoSnapshot[]> {
      const tx = (await database()).transaction(STORE, 'readonly');
      return request<RepoSnapshot[]>(tx.objectStore(STORE).getAll() as IDBRequest<RepoSnapshot[]>);
    },
  };
}
