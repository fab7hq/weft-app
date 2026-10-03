// A fake GitHub for the Worker's tests: the token exchange and /user.
import { vi } from 'vitest';

export interface FakeGitHub {
  exchanges: URLSearchParams[];
}

/** GitHub accepts each code in `codes` once, for the user it names. */
export function fakeGitHub(codes: Record<string, { id: number; login: string }>): FakeGitHub {
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
