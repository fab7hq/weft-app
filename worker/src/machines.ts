// A person's machines (account.md §5): a machine enrols once with the GitHub token
// its device flow got, then tells only a new address with its own token.
// There is no heartbeat: the app finds out a machine is online by reaching it.

import { random, sha256Hex } from './crypto';
import { upsertUser, weftUser } from './github';
import type { Env } from './index';
import { json, refuse } from './respond';
import type { Who } from './session';
import { SQL } from './sql';

const noMachine = () => refuse(401, 'unknown_machine', 'This machine is not on an account.');

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const b = await request.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** POST /api/machine/enrol {github_token, name} */
export async function enrol(request: Request, env: Env): Promise<Response> {
  const { github_token: token, name } = await body(request);
  if (typeof token !== 'string' || typeof name !== 'string' || !name.trim() || name.length > 64) {
    return refuse(400, 'bad_request', 'A machine enrols with a GitHub token and a name.');
  }
  const user = await weftUser(token, env);
  if (!user) return refuse(401, 'github', 'GitHub did not say that token is one Fab7 Weft was given.');
  const userId = await upsertUser(env, user);
  const id = `m_${random(12)}`;
  const machineToken = random(32);
  await env.DB.prepare(SQL.addMachine).bind(id, userId, name.trim(), await sha256Hex(machineToken), Date.now()).run();
  return json({ machine_id: id, machine_token: machineToken, github_id: user.id, login: user.login });
}

/** The machine a request's bearer token names. */
async function machineOf(request: Request, env: Env): Promise<{ id: string; userId: string } | null> {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return null;
  return env.DB.prepare(SQL.machineByToken).bind(await sha256Hex(token)).first<{ id: string; userId: string }>();
}

/** PUT /api/machine/address {address} */
export async function address(request: Request, env: Env): Promise<Response> {
  const machine = await machineOf(request, env);
  if (!machine) return noMachine();
  const { address } = await body(request);
  if (typeof address !== 'string' || address.length > 200 || !/^https:\/\/[a-z0-9.-]+$/.test(address)) {
    return refuse(400, 'bad_request', 'An address is https and a host.');
  }
  await env.DB.prepare(SQL.setAddress).bind(address, Date.now(), machine.id).run();
  return new Response(null, { status: 204 });
}

/** DELETE /api/machine: the machine leaves the account. */
export async function leave(request: Request, env: Env): Promise<Response> {
  const machine = await machineOf(request, env);
  if (!machine) return noMachine();
  await env.DB.prepare(SQL.leave).bind(machine.id).run();
  removed('machine', machine.id, request);
  return new Response(null, { status: 204 });
}

/** GET /api/machines */
export async function list(me: Who, env: Env): Promise<Response> {
  const rows = await env.DB.prepare(SQL.machines).bind(me.userId).all();
  return json(rows.results);
}

/** One log line for each machine that leaves an account: by whom, and from where. */
export function removed(by: 'web' | 'machine' | 'account', machine: string, request: Request): void {
  console.log(JSON.stringify({ event: 'machine_removed', by, machine, agent: request.headers.get('user-agent') ?? '' }));
}

/** DELETE /api/machines/:id */
export async function remove(me: Who, id: string, env: Env, request: Request): Promise<Response> {
  const done = await env.DB.prepare(SQL.removeMachine).bind(id, me.userId).run();
  if (done.meta.changes) removed('web', id, request);
  return done.meta.changes ? new Response(null, { status: 204 }) : refuse(404, 'not_found', 'No such machine on your account.');
}
