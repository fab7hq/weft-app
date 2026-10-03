// Assertions (account.md §7): Fab7's word, for 60 seconds, that a device is
// asked for by the same GitHub user who owns a Mac. Ed25519 through
// WebCrypto; the wire form is `base64url(json) "." base64url(signature)`,
// signed over the first part as sent. The Mac checks it with the public key
// built into Weft; the service never admits a device itself.

import { base64url, unbase64url } from './crypto';
import type { Env } from './index';
import { json, refuse } from './respond';
import type { Who } from './session';
import { SQL } from './sql';

const LASTS = 60;
const PER_MINUTE = 10;

/** The PKCS#8 PEM in the `ASSERTION_KEY` secret, as a signing key. */
async function signingKey(pem: string): Promise<CryptoKey> {
  const der = unbase64url(
    pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''),
  )!;
  return crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, false, ['sign']);
}

export async function sign(pem: string, claims: Record<string, unknown>): Promise<string> {
  const payload = base64url(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign({ name: 'Ed25519' }, await signingKey(pem), new TextEncoder().encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}

/** POST /api/assertion {machine, device} */
export async function assertion(request: Request, me: Who, env: Env): Promise<Response> {
  let asked: { machine?: unknown; device?: unknown } = {};
  try {
    asked = await request.json();
  } catch {
    // Read as nothing asked.
  }
  const { machine, device } = asked;
  if (typeof machine !== 'string' || typeof device !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(device)) {
    return refuse(400, 'bad_request', 'An assertion is for a machine and a device.');
  }
  const owner = await env.DB.prepare(SQL.machineOwner).bind(machine).first<{ userId: string }>();
  if (!owner || owner.userId !== me.userId) return refuse(404, 'not_found', 'No such Mac on your account.');
  // Ten a minute, counted in the session's own row: one write.
  const minute = Math.floor(Date.now() / 60_000);
  const count = me.minute === minute ? me.asserted + 1 : 1;
  if (count > PER_MINUTE) return refuse(429, 'busy', 'Too many in a minute. Try again shortly.');
  await env.DB.prepare(SQL.countAssertion).bind(minute, count, me.hash).run();
  const exp = Math.floor(Date.now() / 1000) + LASTS;
  const claims = { iss: 'fab7', sub: me.githubId, login: me.login, machine, device, exp };
  return json({ assertion: await sign(env.ASSERTION_KEY, claims) });
}
