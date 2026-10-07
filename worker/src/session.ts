// Fab7's own session (account.md §4): a random cookie, kept in D1 only as its
// SHA-256, thirty days, fixed. Every call reads one row by its key.

import { removed } from './machines';
import { random, sha256Hex } from './crypto';
import type { Env } from './index';
import { SQL } from './sql';

export const SESSION_COOKIE = '__Host-session';
const DAYS_30 = 30 * 24 * 60 * 60;

export interface Who {
  hash: string;
  userId: string;
  login: string;
  githubId: number;
  /** Assertions given this minute (account.md §8). */
  minute: number;
  asserted: number;
}

export function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return null;
}

/** A new session for this user: its Set-Cookie line. */
export async function startSession(env: Env, userId: string): Promise<string> {
  const cookie = random(32);
  await env.DB.prepare(SQL.startSession)
    .bind(await sha256Hex(cookie), userId, Date.now() + DAYS_30 * 1000)
    .run();
  return `${SESSION_COOKIE}=${cookie}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=${DAYS_30}`;
}

/** Who this request is signed in as, or nobody. */
export async function who(request: Request, env: Env): Promise<Who | null> {
  const cookie = readCookie(request, SESSION_COOKIE);
  if (!cookie) return null;
  const hash = await sha256Hex(cookie);
  const row = await env.DB.prepare(SQL.session)
    .bind(hash)
    .first<{ userId: string; expiresAt: number; login: string; githubId: number; minute: number; asserted: number }>();
  if (!row || row.expiresAt <= Date.now()) return null;
  const { userId, login, githubId, minute, asserted } = row;
  return { hash, userId, login, githubId, minute, asserted };
}

/** The daily cron: sessions past their thirty days go. */
export async function sweep(env: Env): Promise<void> {
  await env.DB.prepare(SQL.sweep).bind(Date.now()).run();
}

const ENDED = `${SESSION_COOKIE}=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;

/** POST /api/signout: this session, or with `?all=1` every one of the user's. */
export async function signOut(me: Who, everywhere: boolean, env: Env): Promise<Response> {
  const statement = everywhere
    ? env.DB.prepare(SQL.signOutEverywhere).bind(me.userId)
    : env.DB.prepare(SQL.signOut).bind(me.hash);
  await statement.run();
  return new Response(null, { status: 204, headers: { 'set-cookie': ENDED } });
}

/** DELETE /api/me: the user, their sessions and their machines, all at once. */
export async function forget(me: Who, env: Env, request: Request): Promise<Response> {
  const mine = await env.DB.prepare(SQL.machines).bind(me.userId).all<{ id: string }>();
  for (const m of mine.results) removed('account', m.id, request);
  await env.DB.batch([
    env.DB.prepare(SQL.signOutEverywhere).bind(me.userId),
    env.DB.prepare(SQL.forgetMachines).bind(me.userId),
    env.DB.prepare(SQL.forgetUser).bind(me.userId),
  ]);
  return new Response(null, { status: 204, headers: { 'set-cookie': ENDED } });
}
