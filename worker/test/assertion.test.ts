// account.md §11 test 3: an assertion is refused for another user's machine;
// a signed one verifies with the public key; it lasts 60 seconds (§7, §8).
import { env, exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { unbase64url } from '../src/crypto';
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

async function signIn(code: string): Promise<string> {
  const start = await call('GET', '/auth/github');
  const state = new URL(start.headers.get('location')!).searchParams.get('state');
  const r = await call('GET', `/auth/callback?code=${code}&state=${state}`, {
    cookie: `__Host-auth=${cookies(start)['__Host-auth']}`,
  });
  return `__Host-session=${cookies(r)['__Host-session']}`;
}

async function verify(assertion: string): Promise<boolean> {
  const [payload, signature] = assertion.split('.');
  const key = await crypto.subtle.importKey('raw', unbase64url(env.TEST_ASSERTION_PUBLIC)!, { name: 'Ed25519' }, false, ['verify']);
  return crypto.subtle.verify({ name: 'Ed25519' }, key, unbase64url(signature)!, new TextEncoder().encode(payload));
}

describe('assertions', () => {
  it('is signed for the owner of the machine, for 60 seconds, and refused for anyone else', async () => {
    fakeGitHub({ mac: { id: 501, login: 'octo' }, web: { id: 501, login: 'octo' }, eve: { id: 666, login: 'eve' } });
    const joined = await call('POST', '/api/machine/enrol', { body: { github_token: 'gho_mac', name: 'studio' } });
    const { machine_id: machine } = (await joined.json()) as { machine_id: string };
    const me = await signIn('web');
    const eve = await signIn('eve');

    const refused = await call('POST', '/api/assertion', { cookie: eve, body: { machine, device: 'd_eve' } });
    expect(refused.status).toBe(404);
    expect((await call('POST', '/api/assertion', { body: { machine, device: 'd_1' } })).status).toBe(401);
    expect((await call('POST', '/api/assertion', { cookie: me, body: { machine, device: 'not a device!' } })).status).toBe(400);

    const before = Math.floor(Date.now() / 1000);
    const r = await call('POST', '/api/assertion', { cookie: me, body: { machine, device: 'd_phone' } });
    expect(r.status).toBe(200);
    const { assertion } = (await r.json()) as { assertion: string };
    expect(await verify(assertion)).toBe(true);
    const payload = JSON.parse(new TextDecoder().decode(unbase64url(assertion.split('.')[0])!));
    expect(payload).toEqual({ iss: 'fab7', sub: 501, login: 'octo', machine, device: 'd_phone', exp: payload.exp });
    expect(payload.exp - before).toBeGreaterThanOrEqual(60);
    expect(payload.exp - before).toBeLessThanOrEqual(61);
    const tampered = assertion.replace(/^./, (c) => (c === 'e' ? 'f' : 'e'));
    expect(await verify(tampered)).toBe(false);
  });

  it('is given at most ten times a minute to one session', async () => {
    fakeGitHub({ mac: { id: 502, login: 'octo' }, web: { id: 502, login: 'octo' } });
    const joined = await call('POST', '/api/machine/enrol', { body: { github_token: 'gho_mac', name: 'studio' } });
    const { machine_id: machine } = (await joined.json()) as { machine_id: string };
    const me = await signIn('web');
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await call('POST', '/api/assertion', { cookie: me, body: { machine, device: 'd_1' } })).status);
    }
    expect(statuses).toEqual([...Array(10).fill(200), 429]);
  });
});
