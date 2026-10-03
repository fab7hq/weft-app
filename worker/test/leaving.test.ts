// account.md §5, §11 test 5: signing out, everywhere, and deleting the account.
import { env, exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cookies, fakeGitHub } from './github';

const site = 'https://weft.getfab7.com';
afterEach(() => vi.restoreAllMocks());

function call(method: string, path: string, cookie?: string, body?: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  return exports.default.fetch(`${site}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
}

async function signIn(code: string): Promise<string> {
  const start = await call('GET', '/auth/github');
  const state = new URL(start.headers.get('location')!).searchParams.get('state');
  const r = await call('GET', `/auth/callback?code=${code}&state=${state}`, `__Host-auth=${cookies(start)['__Host-auth']}`);
  return `__Host-session=${cookies(r)['__Host-session']}`;
}

const rows = async (githubId: number) => {
  const count = (sql: string) => env.DB.prepare(sql).bind(githubId).first<{ n: number }>().then((r) => r!.n);
  return {
    users: await count('SELECT COUNT(*) AS n FROM users WHERE github_id = ?'),
    sessions: await count('SELECT COUNT(*) AS n FROM sessions WHERE user_id IN (SELECT id FROM users WHERE github_id = ?)'),
    machines: await count('SELECT COUNT(*) AS n FROM machines WHERE user_id IN (SELECT id FROM users WHERE github_id = ?)'),
  };
};

describe('leaving', () => {
  it('signing out ends this session; everywhere ends them all; neither removes a Mac', async () => {
    fakeGitHub({ a: { id: 300, login: 'octo' }, b: { id: 300, login: 'octo' }, c: { id: 300, login: 'octo' }, mac: { id: 300, login: 'octo' } });
    await call('POST', '/api/machine/enrol', undefined, { github_token: 'gho_mac', name: 'studio' });
    const [phone, laptop, tablet] = [await signIn('a'), await signIn('b'), await signIn('c')];
    const out = await call('POST', '/api/signout', phone);
    expect(out.status).toBe(204);
    expect(out.headers.getSetCookie()[0]).toMatch(/^__Host-session=; .*Max-Age=0/);
    expect((await call('GET', '/api/me', phone)).status).toBe(401);
    expect((await call('GET', '/api/me', laptop)).status).toBe(200);
    expect((await call('POST', '/api/signout?all=1', laptop)).status).toBe(204);
    expect((await call('GET', '/api/me', tablet)).status).toBe(401);
    expect(await rows(300)).toEqual({ users: 1, sessions: 0, machines: 1 });
  });

  // Test 5.
  it('deleting the account leaves no row for the user', async () => {
    fakeGitHub({ web: { id: 400, login: 'octo' }, other: { id: 400, login: 'octo' }, mac: { id: 400, login: 'octo' } });
    await call('POST', '/api/machine/enrol', undefined, { github_token: 'gho_mac', name: 'studio' });
    const me = await signIn('web');
    await signIn('other');
    expect(await rows(400)).toEqual({ users: 1, sessions: 2, machines: 1 });
    const r = await call('DELETE', '/api/me', me);
    expect(r.status).toBe(204);
    expect(await rows(400)).toEqual({ users: 0, sessions: 0, machines: 0 });
    expect((await call('GET', '/api/me', me)).status).toBe(401);
  });
});
