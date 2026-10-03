// Sign-in with GitHub (account.md §3): the web flow with PKCE in the browser,
// and the check of a token a Mac got through the device flow. GitHub's token
// is used to read who the person is, once, and never stored.

import { base64url, random, sha256 } from './crypto';
import type { Env } from './index';
import { readCookie, startSession } from './session';
import { refuse } from './respond';

const AUTHORIZE = 'https://github.com/login/oauth/authorize';
const TOKEN = 'https://github.com/login/oauth/access_token';
const USER = 'https://api.github.com/user';
/** The sign-in in progress: its state and PKCE verifier, for ten minutes. */
const AUTH_COOKIE = '__Host-auth';

export interface GitHubUser {
  id: number;
  login: string;
}

/** GET /auth/github */
export async function begin(request: Request, env: Env): Promise<Response> {
  const state = random(24);
  const verifier = random(32);
  const challenge = base64url(await sha256(verifier));
  const to = new URL(AUTHORIZE);
  to.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  to.searchParams.set('redirect_uri', callback(request));
  to.searchParams.set('state', state);
  to.searchParams.set('code_challenge', challenge);
  to.searchParams.set('code_challenge_method', 'S256');
  const headers = new Headers({ location: to.toString() });
  headers.append('set-cookie', `${AUTH_COOKIE}=${state}.${verifier}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`);
  return new Response(null, { status: 302, headers });
}

/** GET /auth/callback */
export async function finish(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const [state, verifier] = (readCookie(request, AUTH_COOKIE) ?? '').split('.');
  const code = url.searchParams.get('code');
  if (!state || !verifier || !code || url.searchParams.get('state') !== state) {
    return refuse(400, 'state', 'That sign-in was not started here. Try again.');
  }
  const exchanged = await fetch(TOKEN, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callback(request),
      code_verifier: verifier,
    }),
  });
  const token = ((await exchanged.json()) as { access_token?: string }).access_token;
  if (!token) return refuse(400, 'code', 'GitHub did not accept that sign-in. Try again.');
  const user = await whoIs(token);
  if (!user) return refuse(400, 'code', 'GitHub did not say who you are. Try again.');
  const userId = await upsertUser(env, user);
  const headers = new Headers({ location: '/' });
  headers.append('set-cookie', await startSession(env, userId));
  headers.append('set-cookie', `${AUTH_COOKIE}=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  return new Response(null, { status: 302, headers });
}

/** Who a GitHub token belongs to, or nothing. */
export async function whoIs(token: string): Promise<GitHubUser | null> {
  const r = await fetch(USER, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'weft-app' },
  });
  if (!r.ok) return null;
  const u = (await r.json()) as Partial<GitHubUser>;
  return typeof u.id === 'number' && typeof u.login === 'string' ? { id: u.id, login: u.login } : null;
}

/** One user per GitHub id, whatever their login is now. Their id. */
export async function upsertUser(env: Env, user: GitHubUser): Promise<string> {
  const row = await env.DB.prepare(
    `INSERT INTO users (id, github_id, login, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (github_id) DO UPDATE SET login = excluded.login
     RETURNING id`,
  )
    .bind(random(16), user.id, user.login, Date.now())
    .first<{ id: string }>();
  return row!.id;
}

function callback(request: Request): string {
  return `${new URL(request.url).origin}/auth/callback`;
}
