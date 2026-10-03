// What the browser keeps (web-app.md §9), in IndexedDB: this device, and per
// machine its last address and its device token, and the agent a
// notification asked to open. No library for four keys.

type Name = 'devices' | 'macs' | 'open';

function db(): Promise<IDBDatabase> {
  return new Promise((done, fail) => {
    const r = indexedDB.open('weft', 1);
    r.onupgradeneeded = () => {
      for (const name of ['devices', 'macs', 'open']) r.result.createObjectStore(name);
    };
    r.onsuccess = () => done(r.result);
    r.onerror = () => fail(r.error);
  });
}

function run<T>(name: Name, mode: IDBTransactionMode, act: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((done, fail) => {
        const r = act(d.transaction(name, mode).objectStore(name));
        r.onsuccess = () => done(r.result as T);
        r.onerror = () => fail(r.error);
      }),
  );
}

export const get = <T>(name: Name, key: string) => run<T | undefined>(name, 'readonly', (s) => s.get(key));
export const set = (name: Name, key: string, value: unknown) => run<void>(name, 'readwrite', (s) => s.put(value, key));
export const del = (name: Name, key: string) => run<void>(name, 'readwrite', (s) => s.delete(key));
export const clear = (name: Name) => run<void>(name, 'readwrite', (s) => s.clear());

/** This device: made once, named after what it is. */
export async function device(): Promise<{ id: string; name: string }> {
  const kept = await get<{ id: string; name: string }>('devices', 'this');
  if (kept) return kept;
  const id = `d_${[...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  const ua = navigator.userAgent;
  const name = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : 'Browser';
  const made = { id, name };
  await set('devices', 'this', made);
  return made;
}

export interface Kept {
  address?: string;
  token?: string;
}
