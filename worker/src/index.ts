// The account service (account.md): who is signed in, which Macs are theirs,
// where each can be reached, and a short-lived proof that a device belongs to
// a Mac's owner. No screen, key, record or push passes through it.

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export function refuse(status: number, code: string, message: string): Response {
  return json({ code, message }, status);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    switch (route) {
      case 'GET /api/me':
        return refuse(401, 'signed_out', 'Sign in with GitHub first.');
    }
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
      return refuse(404, 'not_found', 'There is nothing here.');
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
