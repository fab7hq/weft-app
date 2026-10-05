// The account service (account.md §5): who is signed in, their machines, and
// an assertion for allowing a device. Nothing a machine shows passes here.

export interface Machine {
  id: string;
  name: string;
  address: string | null;
  address_at: number | null;
}

export class Offline extends Error {}

async function call(method: string, path: string, body?: unknown): Promise<Response> {
  try {
    return await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Offline();
  }
}

/** Who is signed in, or nobody. */
export async function me(): Promise<{ login: string; github_id: number } | null> {
  const r = await call('GET', '/api/me');
  if (r.status === 401) return null;
  if (!r.ok) throw new Offline();
  return r.json();
}

export async function machines(): Promise<Machine[]> {
  const r = await call('GET', '/api/machines');
  if (!r.ok) throw new Offline();
  return r.json();
}

/** Take a machine off the account. Weft on it is not touched. */
export async function removeMachine(id: string): Promise<void> {
  const r = await call('DELETE', `/api/machines/${encodeURIComponent(id)}`);
  if (!r.ok && r.status !== 404) throw new Offline();
}

/** Fab7's word that this device is the machine's owner's, for 60 seconds. */
export async function assertion(machine: string, device: string): Promise<string> {
  const r = await call('POST', '/api/assertion', { machine, device });
  if (!r.ok) throw new Error(((await r.json()) as { message?: string }).message ?? 'No assertion');
  return ((await r.json()) as { assertion: string }).assertion;
}

export async function signOut(everywhere: boolean): Promise<void> {
  await call('POST', everywhere ? '/api/signout?all=1' : '/api/signout');
}

export async function deleteAccount(): Promise<void> {
  await call('DELETE', '/api/me');
}
