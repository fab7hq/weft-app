// account.md §11 tests 1 and 2: web sign-in and sessions (§3, §4).
import { env, exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../src/index';
import { cookies, fakeGitHub } from './github';

const site = 'https://weft.getfab7.com';
const get = (path: string, cookie?: string) =>
  exports.default.fetch(`${site}${path}`, { redirect: 'manual', headers: cookie ? { cookie } : {} });

afterEach(() => vi.restoreAllMocks());

/** Start a sign-in: the state, and the cookie that carries it. */
async function start(): Promise<{ state: string; auth: string; location: URL }> {
  const r = await get('/auth/github');
  expect(r.status).toBe(302);
  const location = new URL(r.headers.get('location')!);
  const auth = cookies(r)['__Host-auth'];
  return { state: location.searchParams.get('state')!, auth: `__Host-auth=${auth}`, location };
}

describe('signing in with GitHub', () => {
  it('sends the person to GitHub with a state and a PKCE challenge', async () => {
    const r = await get('/auth/github');
    const location = new URL(r.headers.get('location')!);
    expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(location.searchParams.get('client_id')).toBe('Iv23liun7wYzjax5d6p3');
    expect(location.searchParams.get('redirect_uri')).toBe(`${site}/auth/callback`);
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    const set = r.headers.getSetCookie()[0];
    expect(set).toMatch(/^__Host-auth=/);
    expect(set).toContain('HttpOnly');
    expect(set).toContain('Secure');
    expect(set).toContain('Max-Age=600');
  });

  it('refuses a wrong state', async () => {
    fakeGitHub({ good: { id: 42, login: 'octo' } });
    const { auth } = await start();
    const r = await get('/auth/callback?code=good&state=forged', auth);
    expect(r.status).toBe(400);
    expect(cookies(r)['__Host-session']).toBeUndefined();
  });

  it('refuses a code used before', async () => {
    fakeGitHub({ once: { id: 42, login: 'octo' } });
    const first = await start();
    expect((await get(`/auth/callback?code=once&state=${first.state}`, first.auth)).status).toBe(302);
    const again = await start();
    const r = await get(`/auth/callback?code=once&state=${again.state}`, again.auth);
    expect(r.status).toBe(400);
    expect(cookies(r)['__Host-session']).toBeUndefined();
  });

  it('sets the session cookie and makes one user however many times they sign in', async () => {
    const fake = fakeGitHub({ a: { id: 4242, login: 'octo' }, b: { id: 4242, login: 'octo-renamed' } });
    let session = '';
    for (const code of ['a', 'b']) {
      const { state, auth, location } = await start();
      const r = await get(`/auth/callback?code=${code}&state=${state}`, auth);
      expect(r.status).toBe(302);
      expect(r.headers.get('location')).toBe('/');
      const set = r.headers.getSetCookie().find((c: string) => c.startsWith('__Host-session='))!;
      expect(set).toMatch(/HttpOnly/);
      expect(set).toMatch(/Secure/);
      expect(set).toMatch(/SameSite=Lax/);
      expect(set).toMatch(/Path=\//);
      expect(set).toMatch(/Max-Age=2592000/);
      session = cookies(r)['__Host-session'];
      // The verifier matches the challenge GitHub was sent.
      const verifier = fake.exchanges.at(-1)!.get('code_verifier')!;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
      const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
      expect(location.searchParams.get('code_challenge')).toBe(challenge);
    }
    const users = await env.DB.prepare('SELECT github_id, login FROM users WHERE github_id = 4242').all();
    expect(users.results).toEqual([{ github_id: 4242, login: 'octo-renamed' }]);
    const me = await get('/api/me', `__Host-session=${session}`);
    expect(await me.json()).toEqual({ login: 'octo-renamed', github_id: 4242 });
    // The cookie itself is not what is kept.
    const kept = await env.DB.prepare('SELECT hash FROM sessions').all<{ hash: string }>();
    expect(kept.results.some((r) => r.hash === session)).toBe(false);
  });
});

describe('sessions', () => {
  async function signedIn(code: string, id: number): Promise<string> {
    fakeGitHub({ [code]: { id, login: `user${id}` } });
    const { state, auth } = await start();
    const r = await get(`/auth/callback?code=${code}&state=${state}`, auth);
    vi.restoreAllMocks();
    return `__Host-session=${cookies(r)['__Host-session']}`;
  }

  const calls = ['GET /api/me', 'GET /api/machines'];

  it('answers 401 without a cookie, with an expired one and with a deleted one', async () => {
    const live = await signedIn('live', 7);
    expect((await get('/api/me', live)).status).toBe(200);
    const expired = await signedIn('old', 8);
    await env.DB.prepare('UPDATE sessions SET expires_at = 1 WHERE user_id = (SELECT id FROM users WHERE github_id = 8)').run();
    const deleted = await signedIn('gone', 9);
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE github_id = 9)').run();
    for (const call of calls) {
      const [, path] = call.split(' ');
      for (const cookie of [undefined, expired, deleted, '__Host-session=made-up']) {
        expect((await get(path, cookie)).status, `${call} with ${cookie}`).toBe(401);
      }
    }
  });

  it('deletes expired sessions on the daily cron', async () => {
    await signedIn('stale', 10);
    await env.DB.prepare('UPDATE sessions SET expires_at = 1 WHERE user_id = (SELECT id FROM users WHERE github_id = 10)').run();
    const controller = { cron: '0 3 * * *', scheduledTime: Date.now(), noRetry() {} } as ScheduledController;
    await worker.scheduled(controller, env as unknown as Env);
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE expires_at < ?').bind(Date.now()).first<{ n: number }>();
    expect(left?.n).toBe(0);
  });
});
