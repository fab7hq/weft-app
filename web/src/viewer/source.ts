// Where a file's bytes come from: a URL the machine serves it at, read in
// slices with `Range`, so a file of any size says how far it has come, on a
// phone (the private link) as on the desktop (its own scheme, which answers
// each slice whole). A file that changes between two slices is read again
// from its start, so the slices joined are always one version of it.

/** How much each request asks for. */
export const SLICE = 8 * 1024 * 1024;

/** How often a file that keeps changing is read again before it is said to be unreadable. */
export const TRIES = 3;

export interface Progress {
  done: number;
  total: number;
}

/** The whole file; `gone` when the URL no longer serves it (404); else why it could not be read. */
export type Loaded = { bytes: Uint8Array } | { gone: true } | { failed: string };

export interface LoadOptions {
  progress?: (p: Progress) => void;
  signal?: AbortSignal;
  slice?: number;
  tries?: number;
  fetch?: typeof fetch;
}

/** The file at `url`, said to be `size` bytes, read a slice at a time. */
export async function load(url: string, size: number, o: LoadOptions = {}): Promise<Loaded> {
  const get = o.fetch ?? fetch;
  const slice = o.slice ?? SLICE;
  const tries = o.tries ?? TRIES;
  try {
    for (let n = 0; n < tries; n++) {
      const r = await once(get, url, size, slice, o);
      if (!('changed' in r)) return r;
      size = r.changed;
    }
    return { failed: 'changed' };
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortError') throw e;
    return { failed: e instanceof RangeError ? 'memory' : String((e as Error).message ?? e) };
  }
}

/** One read from the start; `changed` (with the size it says now) when the file changed under it. */
async function once(get: typeof fetch, url: string, size: number, slice: number, o: LoadOptions): Promise<Loaded | { changed: number }> {
  let out: Uint8Array | null = null;
  let total = size;
  let version: string | null = null;
  let at = 0;
  const said = (done: number) => o.progress?.({ done, total });
  said(0);
  do {
    // Not knowing its size, the first slice asks for a whole slice and learns it.
    const end = (total > 0 ? Math.min(at + slice, total) : at + slice) - 1;
    const res = await get(url, { headers: { Range: `bytes=${at}-${end}` }, signal: o.signal, cache: 'no-store' });
    if (res.status === 404) return { gone: true };
    // An empty file has no byte to give a range of.
    if (res.status === 416 && at === 0) return { bytes: new Uint8Array(0) };
    if (res.status !== 200 && res.status !== 206) return { failed: `HTTP ${res.status}` };
    const modified = res.headers.get('Last-Modified');
    if (at === 0) version = modified;
    else if (modified !== version) return { changed: total };
    if (res.status === 200) {
      // Served whole: the range was not taken, so this one answer is the file.
      const length = Number(res.headers.get('Content-Length'));
      total = Number.isFinite(length) && length > 0 ? length : total;
      return { bytes: await body(res, null, 0, (d) => said(d)) };
    }
    const range = /\/(\d+)\s*$/.exec(res.headers.get('Content-Range') ?? '');
    const whole = range ? Number(range[1]) : total;
    if (at === 0) total = whole;
    else if (whole !== total) return { changed: whole };
    out ??= new Uint8Array(total);
    const before = at;
    at += (await body(res, out, at, (d) => said(before + d))).length;
    said(at);
    // A slice shorter than asked for, and not the last: the file is shorter than it said.
    if (at < total && at - before < end - before + 1) return { changed: at };
  } while (at < total);
  return { bytes: out ?? new Uint8Array(0) };
}

/** A response's bytes, into `into` at `at` when given; `read` is told how many have come, as they come. */
async function body(res: Response, into: Uint8Array | null, at: number, read: (done: number) => void): Promise<Uint8Array> {
  const reader = res.body?.getReader?.();
  if (!reader) {
    const bytes = new Uint8Array(await res.arrayBuffer());
    read(bytes.length);
    if (!into) return bytes;
    into.set(bytes.subarray(0, into.length - at), at);
    return bytes.subarray(0, into.length - at);
  }
  const parts: Uint8Array[] = [];
  let done = 0;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    if (into) {
      const room = into.length - at - done;
      const take = value.length > room ? value.subarray(0, room) : value;
      into.set(take, at + done);
      done += take.length;
    } else {
      parts.push(value);
      done += value.length;
    }
    read(done);
  }
  return into ? into.subarray(at, at + done) : join(parts);
}

export function join(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1) return parts[0];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
