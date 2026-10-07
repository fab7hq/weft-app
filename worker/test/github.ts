// A fake GitHub for the Worker's tests: the token exchange and /user.
import { vi } from 'vitest';

export interface FakeGitHub {
  exchanges: URLSearchParams[];
}

/** The app's client id, as wrangler.jsonc has it, and the tests' secret. */
const CLIENT_ID = 'Iv23liun7wYzjax5d6p3';
const CLIENT_SECRET = 'test-secret';

/** GitHub accepts each code in `codes` once, for the user it names. A token
 * in `elsewhere` is one another app was given, for the same user. */
export function fakeGitHub(codes: Record<string, { id: number; login: string }>, elsewhere: string[] = []): FakeGitHub {
  const fake: FakeGitHub = { exchanges: [] };
  const used = new Set<string>();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    if (request.url === 'https://github.com/login/oauth/access_token') {
      const form = new URLSearchParams(await request.text());
      fake.exchanges.push(form);
      const code = form.get('code') ?? '';
      if (!(code in codes) || used.has(code)) {
        return Response.json({ error: 'bad_verification_code' });
      }
      used.add(code);
      return Response.json({ access_token: `gho_${code}`, token_type: 'bearer' });
    }
    if (request.method === 'POST' && request.url === `https://api.github.com/applications/${CLIENT_ID}/token`) {
      // Only the app itself may ask, with its client id and secret.
      if (request.headers.get('authorization') !== `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`) return new Response('{}', { status: 401 });
      const token = String(((await request.json()) as { access_token?: unknown }).access_token ?? '').replace('gho_', '');
      const user = codes[token];
      if (!user) return new Response('{}', { status: 404 });
      return Response.json({ app: { client_id: elsewhere.includes(token) ? 'Iv23someOtherApp' : CLIENT_ID }, user });
    }
    if (request.url === 'https://api.github.com/user') {
      const token = request.headers.get('authorization')?.replace('Bearer gho_', '') ?? '';
      const user = codes[token];
      return user ? Response.json(user) : new Response('{}', { status: 401 });
    }
    throw new Error(`unexpected request: ${request.method} ${request.url}`);
  });
  return fake;
}

/** The cookies a response sets, by name. */
export function cookies(r: Response): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of r.headers.getSetCookie()) {
    const [pair] = line.split(';');
    const at = pair.indexOf('=');
    out[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return out;
}
