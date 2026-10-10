// account.md §11 tests 4 and 6: machines (§5), and every query through a key
// or an index (§6).
import { env, exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SQL } from '../src/sql';
import { cookies, fakeGitHub } from './github';

const site = 'https://weft.getfab7.com';
afterEach(() => vi.restoreAllMocks());

function call(method: string, path: string, opts: { body?: unknown; bearer?: string; cookie?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  if (opts.cookie) headers.cookie = opts.cookie;
  const body = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  return exports.default.fetch(`${site}${path}`, { method, headers, body, redirect: 'manual' });
}

/** A Mac joins with the token its device flow got. */
async function enrol(token: string, name: string): Promise<{ machine_id: string; machine_token: string }> {
  const r = await call('POST', '/api/machine/enrol', { body: { github_token: token, name } });
  expect(r.status).toBe(200);
  return r.json();
}

async function signIn(code: string): Promise<string> {
  const start = await call('GET', '/auth/github');
  const state = new URL(start.headers.get('location')!).searchParams.get('state');
  const auth = `__Host-auth=${cookies(start)['__Host-auth']}`;
  const r = await call('GET', `/auth/callback?code=${code}&state=${state}`, { cookie: auth });
  return `__Host-session=${cookies(r)['__Host-session']}`;
}

describe('machines', () => {
  it('a Mac enrols with a GitHub token it does not keep, and the person sees it', async () => {
    fakeGitHub({ mac: { id: 77, login: 'octo' }, web: { id: 77, login: 'octo' }, other: { id: 78, login: 'eve' } });
    const joined = await call('POST', '/api/machine/enrol', { body: { github_token: 'gho_mac', name: 'studio' } });
    const m = (await joined.json()) as Record<string, unknown>;
    expect(Object.keys(m).sort()).toEqual(['github_id', 'login', 'machine_id', 'machine_token']);
    expect(m.github_id).toBe(77);
    expect(String(m.machine_token)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = await env.DB.prepare('SELECT token_hash FROM machines WHERE id = ?').bind(m.machine_id).first<{ token_hash: string }>();
    expect(row!.token_hash).not.toBe(m.machine_token);
    const bad = await call('POST', '/api/machine/enrol', { body: { github_token: 'gho_nobody', name: 'x' } });
    expect(bad.status).toBe(401);

    const me = await signIn('web');
    const list = await call('GET', '/api/machines', { cookie: me });
    expect(await list.json()).toEqual([{ id: m.machine_id, name: 'studio', address: null, address_at: null, seen_at: null }]);
    const eve = await signIn('other');
    expect(await (await call('GET', '/api/machines', { cookie: eve })).json()).toEqual([]);
    expect((await call('DELETE', `/api/machines/${m.machine_id}`, { cookie: eve })).status).toBe(404);
    expect((await call('DELETE', `/api/machines/${m.machine_id}`, { cookie: me })).status).toBe(204);
    expect(await (await call('GET', '/api/machines', { cookie: me })).json()).toEqual([]);
  });

  // Test 4.
  it('a token another app was given enrols nothing, though GitHub knows whose it is', async () => {
    fakeGitHub({ elsewhere: { id: 77, login: 'octo' } }, ['elsewhere']);
    const r = await call('POST', '/api/machine/enrol', { body: { github_token: 'gho_elsewhere', name: 'MacBook Pro' } });
    expect(r.status).toBe(401);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM machines').first<{ n: number }>();
    expect(n!.n).toBe(0);
  });

  it('an address with a wrong token is 401; with the right one, one row changes', async () => {
    fakeGitHub({ a: { id: 90, login: 'octo' }, b: { id: 90, login: 'octo' } });
    const studio = await enrol('gho_a', 'studio');
    const laptop = await enrol('gho_b', 'laptop');
    const address = { address: 'https://seating-texas-air-guns.trycloudflare.com' };
    expect((await call('PUT', '/api/machine/address', { body: address, bearer: 'wrong' })).status).toBe(401);
    expect((await call('PUT', '/api/machine/address', { body: address })).status).toBe(401);
    const before = await env.DB.prepare('SELECT id, address FROM machines WHERE user_id = (SELECT id FROM users WHERE github_id = 90) ORDER BY id').all();
    const r = await call('PUT', '/api/machine/address', { body: address, bearer: studio.machine_token });
    expect(r.status).toBe(204);
    const after = await env.DB.prepare('SELECT id, address FROM machines WHERE user_id = (SELECT id FROM users WHERE github_id = 90) ORDER BY id').all<{ id: string; address: string | null }>();
    const changed = after.results.filter((row, i) => row.address !== (before.results[i] as { address: string | null }).address);
    expect(changed).toEqual([{ id: studio.machine_id, address: address.address }]);
    expect(after.results.find((r) => r.id === laptop.machine_id)!.address).toBeNull();
    const nonsense = await call('PUT', '/api/machine/address', { body: { address: 'javascript:alert(1)' }, bearer: studio.machine_token });
    expect(nonsense.status).toBe(400);

    // The Mac leaves.
    expect((await call('DELETE', '/api/machine', { bearer: laptop.machine_token })).status).toBe(204);
    expect((await call('PUT', '/api/machine/address', { body: address, bearer: laptop.machine_token })).status).toBe(401);
  });

  // ADR-0034 D4: the service keeps when it last heard from each machine, and
  // the person's list says so, for the phone to show while it cannot reach it.
  it('every report, the same address or not, is when the service last heard from the machine', async () => {
    fakeGitHub({ a: { id: 91, login: 'octo' }, web: { id: 91, login: 'octo' } });
    const studio = await enrol('gho_a', 'studio');
    const address = { address: 'https://seating-texas-air-guns.trycloudflare.com' };
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_790_000_000_000);
    expect((await call('PUT', '/api/machine/address', { body: address, bearer: studio.machine_token })).status).toBe(204);
    const me = await signIn('web');
    const first = (await (await call('GET', '/api/machines', { cookie: me })).json()) as { seen_at: number }[];
    expect(first[0].seen_at).toBe(1_790_000_000_000);
    clock.mockReturnValue(1_790_000_300_000);
    await call('PUT', '/api/machine/address', { body: address, bearer: studio.machine_token });
    const again = (await (await call('GET', '/api/machines', { cookie: me })).json()) as { seen_at: number }[];
    expect(again[0].seen_at).toBe(1_790_000_300_000);
  });

  it('a Mac that left is 401 when it reports', async () => {
    fakeGitHub({ b: { id: 92, login: 'octo' } });
    const laptop = await enrol('gho_b', 'laptop');
    const address = { address: 'https://seating-texas-air-guns.trycloudflare.com' };
    expect((await call('DELETE', '/api/machine', { bearer: laptop.machine_token })).status).toBe(204);
    expect((await call('PUT', '/api/machine/address', { body: address, bearer: laptop.machine_token })).status).toBe(401);
  });
});

// Test 6.
describe('every query', () => {
  it('goes through a key or an index', async () => {
    for (const [name, sql] of Object.entries(SQL)) {
      const args = (sql.match(/\?/g) ?? []).map(() => 'x');
      const plan = await env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind(...args).all<{ detail: string }>();
      for (const { detail } of plan.results) {
        const scan = /^SCAN /.test(detail) && !/USING (COVERING )?INDEX|PRIMARY KEY/.test(detail);
        expect(scan, `${name}: ${detail}`).toBe(false);
      }
    }
  });
});
