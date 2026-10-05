// Seeds the local D1 under `wrangler dev` with a user, a session and
// machines, as the Worker writes them, and hands back the session cookie.
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import type { BrowserContext } from '@playwright/test';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function sql(statements: string): void {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'weft', '--local', '--persist-to', '.wrangler/e2e', '--command', statements], {
    stdio: 'pipe',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
}

export interface Seeded {
  userId: string;
  githubId: number;
  login: string;
  cookie: string;
  machines: { id: string; name: string; address: string | null }[];
}

let next = Date.now() % 1_000_000;

/** A signed-in person with these machines. */
export function person(login: string, machines: { name: string; address?: string }[]): Seeded {
  next += 1;
  const githubId = next;
  const userId = `u_${randomBytes(6).toString('hex')}`;
  const cookie = randomBytes(32).toString('base64url');
  const now = Date.now();
  const rows = machines.map((m, i) => ({ id: `m_${userId}_${i}`, name: m.name, address: m.address ?? null }));
  const q = (s: string | null) => (s === null ? 'NULL' : `'${s.replaceAll("'", "''")}'`);
  sql(
    [
      `INSERT INTO users (id, github_id, login, created_at) VALUES (${q(userId)}, ${githubId}, ${q(login)}, ${now});`,
      `INSERT INTO sessions (hash, user_id, expires_at) VALUES (${q(sha256(cookie))}, ${q(userId)}, ${now + 86_400_000});`,
      ...rows.map(
        (m, i) =>
          `INSERT INTO machines (id, user_id, name, token_hash, address, address_at, created_at) VALUES (${q(m.id)}, ${q(userId)}, ${q(m.name)}, ${q(sha256(m.id))}, ${q(m.address)}, ${m.address ? now : 'NULL'}, ${now + i});`,
      ),
    ].join(' '),
  );
  return { userId, githubId, login, cookie, machines: rows };
}

export async function signIn(context: BrowserContext, p: Seeded): Promise<void> {
  await context.addCookies([
    { name: '__Host-session', value: p.cookie, domain: 'localhost', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' },
  ]);
}

/** A machine joining this person's account, as the Worker records one. */
export function addMachine(p: Seeded, name: string, address: string): void {
  const id = `m_${p.userId}_${p.machines.length}`;
  const now = Date.now();
  sql(`INSERT INTO machines (id, user_id, name, token_hash, address, address_at, created_at) VALUES ('${id}', '${p.userId}', '${name}', '${sha256(id)}', '${address}', ${now}, ${now});`);
  p.machines.push({ id, name, address });
}
