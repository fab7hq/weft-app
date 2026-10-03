// The account service (account.md): who is signed in, which Macs are theirs,
// where each can be reached, and a short-lived proof that a device belongs to
// a Mac's owner. No screen, key, record or push passes through it.

import { begin, finish } from './github';
import { json, refuse } from './respond';
import { sweep, who } from './session';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** The Fab7 Weft GitHub App's client id: public. */
  GITHUB_CLIENT_ID: string;
  /** Its client secret: a Worker secret. */
  GITHUB_CLIENT_SECRET: string;
}

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
  const me = await who(request, env);
  switch (`${request.method} ${url.pathname}`) {
    case 'GET /api/me':
      return me ? json({ login: me.login, github_id: me.githubId }) : signedOut();
    case 'GET /api/machines':
      if (!me) return signedOut();
      return json([]);
  }
  return refuse(404, 'not_found', 'There is nothing here.');
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
