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
  /** The agent still runs: `ended` is then its turn, not the agent. */
  running: boolean;
  since: number;
}

/** Why an act cannot run: a words key, and the harness and work it names. */
export interface Why {
  key: string;
  harness?: string;
  title?: string;
}

/** An Ask as a round lists it: its title and harness; ASKED or ASKING only under Open. */
export interface Ask {
  unit: string;
  title: string;
  harness: string;
  word?: 'asked' | 'asking';
}

/** One session weftd holds, as AGENTS lists it (remote.md §6c), whichever program runs it. */
export interface Session {
  session: string;
  harness: string;
  /** `quiet`: neither running nor ended can be known; it reads "last active 11:25". */
  state: 'running' | 'ended' | 'quiet';
  turn: 'ready' | 'working' | 'waiting' | 'turn_ended' | null;
  /** Its latest Ask's title; null reads "no Ask yet". */
  title: string | null;
  at: number;
  asks: number;
  /** The tab that holds it, while a Weft pane does. */
  agent: string | null;
  /** Why an Ask cannot go to it, else null. */
  ask: Why | null;
}

/** An Eval's round: being judged, or completed and not sealed yet. */
export interface Round {
  eval: string;
  n: number;
  judging: boolean;
  verdict: 'aligned' | 'drifted' | 'incomplete' | null;
  agreement: string | null;
  asks: Ask[];
  /** Why Seal cannot run on it, else null. */
  seal: Why | null;
}

/** What a project still needs before RingFrame is set up in it; null where nothing could say. */
export interface Needs {
  ringframe: boolean;
  git: boolean | null;
  commit: boolean | null;
}

/** One project of the tree, as weft_core::tree built it on the machine. */
export interface Project {
  project: string;
  open: number;
  needs: number;
  ask: Why | null;
  /** Null when RingFrame is set up there. */
  setup: Needs | null;
  /** Agents started here from now on run in turbo mode (the header's ⚡ turbo). */
  turbo?: boolean;
  /** AGENTS: every running session, then the last 3 ended; `earlier` counts the rest. */
  agents: { running: number; ended: number; rows: Session[]; earlier: number };
  /** WORK, by Eval round: Open, each Eval not sealed (one being judged first), and Sealed as counts. */
  work: {
    open: { since: number | null; asks: Ask[]; eval: Why | null };
    evals: Round[];
    sealed: { seals: number; asks: number };
  };
}

/** A harness a project can start. */
export interface Start {
  project: string;
  harness: string;
  title: string;
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

/** The machines on this person's account. */
export const mine = signal<api.Machine[]>([]);
export const link = signal<Link>('connecting');
/** The open machine has welcomed this device since it was opened: there is a tree to show. */
export const welcomed = signal(false);
export const refusal = signal<string | null>(null);
export const agents = signal<Agent[]>([]);
export const tree = signal<Project[]>([]);
export const harnesses = signal<Start[]>([]);
export const pendings = signal<Pending[]>([]);
export const vapid = signal<string | null>(null);
/** Who has the keys of each agent this device drove: `you` or `mac`. */
export const control = signal<Record<string, 'you' | 'mac'>>({});
/** Answers to requests, by req. */
const waiting = new Map<number, (m: Record<string, unknown>) => void>();
/** The agent whose screen this device watches, and who hears its frames. */
let watching: string | null = null;
/** The size this device would draw the open agent at: the machine gives it when nobody is at the Mac (remote.md §9). */
let watchingSize: { rows: number; cols: number } | null = null;
let onFrame: ((f: Frame) => void) | null = null;
/** Pendings answered elsewhere, for a sheet that was showing one. */
export const resolved = signal<{ id: string; yes: boolean } | null>(null);

/** The machine this device has open. */
export const current = signal<api.Machine | null>(null);

export const needsYou = computed(() => agents.value.filter((a) => a.turn === 'waiting').length);

/** The refusals a machine gives, by the words key that says each. */
const REFUSED = ['denied', 'expired', 'not_owner', 'busy', 'version'];

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
  current.value = m;
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
  welcomed.value = false;
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
    s.send(JSON.stringify({ type: 'hello', v: 3, device: me.id, token: kept.token }));
    return;
  }
  try {
    const assertion = await api.assertion(m.id, me.id);
    s.send(JSON.stringify({ type: 'pair', v: 3, device: me.id, name: me.name, assertion }));
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
      tree.value = (msg.tree as Project[]) ?? [];
      harnesses.value = (msg.harnesses as Start[]) ?? [];
      pendings.value = (msg.pendings as Pending[]) ?? [];
      vapid.value = (msg.vapid as string | null) ?? null;
      link.value = 'connected';
      welcomed.value = true;
      refusal.value = null;
      wait = 1;
      clearInterval(pinger);
      pinger = window.setInterval(() => ping(s), 20_000);
      void store.get<store.Kept>('macs', m.id).then((k) => store.set('macs', m.id, { ...k, address: reached ?? undefined }));
      if (watching) send({ type: 'watch', agent: watching, ...watchingSize });
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
        s.send(JSON.stringify({ type: 'hello', v: 3, device: me.id, token: msg.token }));
      });
      break;
    case 'refused':
      if (msg.code === 'unknown_device') {
        // Removed on the machine, or never allowed: ask to be allowed again.
        void store.get<store.Kept>('macs', m.id).then((k) => store.set('macs', m.id, { ...k, token: undefined }));
      } else {
        refusal.value = `web.refused.${REFUSED.includes(String(msg.code)) ? msg.code : 'other'}`;
        link.value = 'refused';
      }
      break;
    case 'agents':
      agents.value = msg.agents as Agent[];
      break;
    case 'tree':
      tree.value = msg.tree as Project[];
      break;
    case 'harnesses':
      harnesses.value = msg.harnesses as Start[];
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
  // Until it first answers, it is still connecting.
  link.value = welcomed.value ? 'reconnecting' : 'connecting';
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
export function watch(agent: string | null, frames: ((f: Frame) => void) | null, size: { rows: number; cols: number } | null = null): void {
  watching = agent;
  watchingSize = size;
  onFrame = frames;
  send({ type: 'watch', agent, ...size });
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
