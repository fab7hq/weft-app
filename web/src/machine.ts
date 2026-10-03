// One machine, reached through its tunnel (web-app.md §5, remote.md §6): the
// socket, pairing, reconnecting with a backoff, the ping, and what the
// machine says. The app holds no workflow rule: states, counts and pendings
// are the machine's words.
import { computed, signal } from '@preact/signals';
import * as api from './api';
import * as store from './store';

export interface Agent {
  agent: string;
  project: string;
  harness: string;
  title: string;
  turn: 'ready' | 'working' | 'waiting' | 'ended';
  since: number;
  unit?: { id: string; title: string; eval: string | null };
}

export interface Pending {
  id: string;
  agent: string;
  what: string;
  why: string;
  text: string;
}

export interface Frame {
  agent: string;
  seq: number;
  full: boolean;
  rows: number;
  cols: number;
  bytes: string;
}

export type Link = 'connecting' | 'asking' | 'connected' | 'reconnecting' | 'refused';

export const link = signal<Link>('connecting');
export const refusal = signal<string | null>(null);
export const agents = signal<Agent[]>([]);
export const pendings = signal<Pending[]>([]);
export const vapid = signal<string | null>(null);
/** Who has the keys of each agent this device drove: `you` or `mac`. */
export const control = signal<Record<string, 'you' | 'mac'>>({});
/** Answers to requests, by req. */
const waiting = new Map<number, (m: Record<string, unknown>) => void>();
/** The agent whose screen this device watches, and who hears its frames. */
let watching: string | null = null;
let onFrame: ((f: Frame) => void) | null = null;
/** Pendings answered elsewhere, for a sheet that was showing one. */
export const resolved = signal<{ id: string; yes: boolean } | null>(null);

export const needsYou = computed(() => agents.value.filter((a) => a.turn === 'waiting').length);

const REFUSED: Record<string, string> = {
  denied: 'Your machine said no to this device.',
  expired: 'Nobody answered on your machine in two minutes.',
  not_owner: 'This machine belongs to another account.',
  busy: 'Your machine was asked too often. Try again in a few minutes.',
};

let socket: WebSocket | null = null;
let machine: api.Machine | null = null;
let epoch: string | null = null;
let wait = 1;
let retry: number | undefined;
let pinger: number | undefined;
let pongDue: number | undefined;
/** The address the socket was opened at. */
let reached: string | null = null;
let nextReq = 1;
let hiddenClose: number | undefined;

function wsUrl(address: string): string {
  return `${address.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:').replace(/\/$/, '')}/ws`;
}

/** Reach this machine, and keep reaching it. */
export function open(m: api.Machine): void {
  if (machine?.id === m.id && socket) return;
  close();
  machine = m;
  wait = 1;
  void connect();
}

export function close(): void {
  clearTimeout(retry);
  clearInterval(pinger);
  machine = null;
  const s = socket;
  socket = null;
  s?.close();
  link.value = 'connecting';
}

async function connect(): Promise<void> {
  const m = machine;
  if (!m) return;
  const kept = (await store.get<store.Kept>('macs', m.id)) ?? {};
  const address = kept.address ?? m.address;
  if (!address) return later();
  const s = new WebSocket(wsUrl(address));
  socket = s;
  reached = address;
  s.onopen = () => void greet(s, m, kept);
  s.onmessage = (e) => heard(s, m, JSON.parse(String(e.data)));
  s.onclose = () => {
    if (socket === s) lost();
  };
}

async function greet(s: WebSocket, m: api.Machine, kept: store.Kept): Promise<void> {
  const me = await store.device();
  if (kept.token) {
    s.send(JSON.stringify({ type: 'hello', v: 1, device: me.id, token: kept.token }));
    return;
  }
  try {
    const assertion = await api.assertion(m.id, me.id);
    s.send(JSON.stringify({ type: 'pair', v: 1, device: me.id, name: me.name, assertion }));
  } catch {
    s.close();
  }
}

function heard(s: WebSocket, m: api.Machine, msg: Record<string, unknown>): void {
  switch (msg.type) {
    case 'welcome': {
      // A machine that started again knows none of what this device holds.
      if (epoch !== msg.epoch) {
        epoch = String(msg.epoch);
        control.value = {};
      }
      agents.value = (msg.agents as Agent[]) ?? [];
      pendings.value = (msg.pendings as Pending[]) ?? [];
      vapid.value = (msg.vapid as string | null) ?? null;
      link.value = 'connected';
      refusal.value = null;
      wait = 1;
      clearInterval(pinger);
      pinger = window.setInterval(() => ping(s), 20_000);
      void store.get<store.Kept>('macs', m.id).then((k) => store.set('macs', m.id, { ...k, address: reached ?? undefined }));
      if (watching) send({ type: 'watch', agent: watching });
      sendSeen();
      break;
    }
    case 'asking':
      link.value = 'asking';
      break;
    case 'paired':
      void store.get<store.Kept>('macs', m.id).then(async (k) => {
        await store.set('macs', m.id, { ...k, token: String(msg.token) });
        const me = await store.device();
        s.send(JSON.stringify({ type: 'hello', v: 1, device: me.id, token: msg.token }));
      });
      break;
    case 'refused':
      if (msg.code === 'unknown_device') {
        // Removed on the machine, or never allowed: ask to be allowed again.
        void store.get<store.Kept>('macs', m.id).then((k) => store.set('macs', m.id, { ...k, token: undefined }));
      } else {
        refusal.value = REFUSED[String(msg.code)] ?? 'Your machine refused this device.';
        link.value = 'refused';
      }
      break;
    case 'agents':
      agents.value = msg.agents as Agent[];
      break;
    case 'pending':
      pendings.value = [...pendings.value.filter((p) => p.id !== msg.id), msg as unknown as Pending];
      break;
    case 'resolved':
      pendings.value = pendings.value.filter((p) => p.id !== msg.id);
      resolved.value = { id: String(msg.id), yes: Boolean(msg.yes) };
      break;
    case 'control':
      control.value = { ...control.value, [String(msg.agent)]: msg.by as 'you' | 'mac' };
      break;
    case 'screen':
      if (msg.agent === watching) onFrame?.(msg as unknown as Frame);
      break;
    case 'pong':
      clearTimeout(pongDue);
      break;
    case 'ok':
    case 'error': {
      const done = waiting.get(Number(msg.req));
      waiting.delete(Number(msg.req));
      done?.(msg);
      break;
    }
  }
}

function ping(s: WebSocket): void {
  s.send(JSON.stringify({ type: 'ping', t: Date.now() }));
  // No pong in ten seconds counts as closed.
  clearTimeout(pongDue);
  pongDue = window.setTimeout(() => s.close(), 10_000);
}

function lost(): void {
  clearInterval(pinger);
  clearTimeout(pongDue);
  for (const done of waiting.values()) done({ type: 'error', code: 'unknown', message: 'Not known: the connection closed.' });
  waiting.clear();
  if (!machine || link.value === 'refused') return;
  link.value = 'reconnecting';
  later();
}

/** Ask the service for the address again (it may be new), then retry after 1, 2, 4 … 30 s. */
function later(): void {
  const m = machine;
  clearTimeout(retry);
  retry = window.setTimeout(async () => {
    if (!m || machine !== m) return;
    try {
      const fresh = (await api.machines()).find((x) => x.id === m.id);
      if (fresh?.address) {
        machine = fresh;
        const k = (await store.get<store.Kept>('macs', m.id)) ?? {};
        if (k.address !== fresh.address) await store.set('macs', m.id, { ...k, address: fresh.address });
      }
    } catch {
      // The service is away too: try the machine at the address we have.
    }
    void connect();
  }, wait * 1000);
  wait = Math.min(wait * 2, 30);
}

/** Send, only while connected: keys are never queued. */
export function send(message: Record<string, unknown>): boolean {
  if (link.value !== 'connected' || socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
}

/** A request: its answer, `ok` or `error`; not sent at all while not connected. */
export function request(message: Record<string, unknown>): Promise<Record<string, unknown>> | null {
  const req = nextReq++;
  if (!send({ ...message, req })) return null;
  return new Promise((done) => waiting.set(req, done));
}

/** Watch one agent's screen, or none. */
export function watch(agent: string | null, frames: ((f: Frame) => void) | null): void {
  watching = agent;
  onFrame = frames;
  send({ type: 'watch', agent });
  sendSeen();
}

function sendSeen(): void {
  send({ type: 'seen', foreground: document.visibilityState === 'visible', agent: watching });
}

// Hidden: say so, and close after 30 seconds; shown: reconnect and say what is open.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    sendSeen();
    hiddenClose = window.setTimeout(() => socket?.close(), 30_000);
  } else {
    clearTimeout(hiddenClose);
    if (link.value === 'connected') sendSeen();
    else if (machine) {
      wait = 1;
      void connect();
    }
  }
});
