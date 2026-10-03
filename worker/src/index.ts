// The account service (account.md): who is signed in, which Macs are theirs,
// where each can be reached, and a short-lived proof that a device belongs to
// a Mac's owner. No screen, key, record or push passes through it.

import { assertion } from './assert';
import { begin, finish } from './github';
import * as machines from './machines';
import { json, refuse } from './respond';
import { sweep, who } from './session';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** The Fab7 Weft GitHub App's client id: public. */
  GITHUB_CLIENT_ID: string;
  /** Its client secret: a Worker secret. */
  GITHUB_CLIENT_SECRET: string;
  /** Fab7's Ed25519 private key for assertions, PKCS#8 PEM: a Worker secret. */
  ASSERTION_KEY: string;
}

/** The calls a person makes with their session. */
const PERSON = ['GET /api/me', 'GET /api/machines', 'DELETE /api/machines/:id', 'POST /api/assertion'];

const signedOut = () => refuse(401, 'signed_out', 'Sign in with GitHub first.');

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  switch (`${request.method} ${url.pathname}`) {
    case 'GET /auth/github':
      return begin(request, env);
    case 'GET /auth/callback':
      return finish(request, env);
  }
  if (!url.pathname.startsWith('/api/')) return refuse(404, 'not_found', 'There is nothing here.');
  // A Mac's own calls, with its machine token.
  switch (`${request.method} ${url.pathname}`) {
    case 'POST /api/machine/enrol':
      return machines.enrol(request, env);
    case 'PUT /api/machine/address':
      return machines.address(request, env);
    case 'DELETE /api/machine':
      return machines.leave(request, env);
  }
  // The person's, with their session.
  const machine = url.pathname.match(/^\/api\/machines\/([A-Za-z0-9_-]+)$/)?.[1];
  const call = machine ? `${request.method} /api/machines/:id` : `${request.method} ${url.pathname}`;
  if (!PERSON.includes(call)) return refuse(404, 'not_found', 'There is nothing here.');
  const me = await who(request, env);
  if (!me) return signedOut();
  switch (call) {
    case 'GET /api/me':
      return json({ login: me.login, github_id: me.githubId });
    case 'GET /api/machines':
      return machines.list(me, env);
    case 'POST /api/assertion':
      return assertion(request, me, env);
    default:
      return machines.remove(me, machine!, env);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
      return route(request, env);
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await sweep(env);
  },
} satisfies ExportedHandler<Env>;
