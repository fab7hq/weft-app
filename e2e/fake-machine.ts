// A fake machine: speaks the remote protocol (remote.md §6), as
// `weft remote` does, answers each read from its sample a page at a time,
// records every message, and lets a test drop, refuse and hang connections,
// change its epoch and version, wait on an update, and send what the machine
// would.
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import { WebSocketServer, type WebSocket } from 'ws';
import { CLAUDE, CODEX, CODEX_NEW, DOCS, EVAL_3, OPEN, SESSIONS, at, reads } from './atlas-fixtures';

// A test-only certificate: a machine is reached over wss:// as through its
// tunnel, and WebKit refuses ws:// from an https:// page. Playwright ignores
// that it is self-signed.
const TLS = {
  key: readFileSync(new URL('./fixtures/fake-machine.key', import.meta.url)),
  cert: readFileSync(new URL('./fixtures/fake-machine.crt', import.meta.url)),
};

export interface Agent {
  agent: string;
  project: string;
  harness: string;
  title: string;
  turn: 'ready' | 'working' | 'waiting' | 'ended';
  running: boolean;
  since: number;
}

/** A why-not: a words key, and the harness and work its sentence names. */
export interface Why {
  key: string;
  harness?: string;
  title?: string;
}

/** An Ask as a round lists it; `word` only under Open. */
export interface Ask {
  unit: string;
  title: string;
  harness: string;
  word?: 'asked' | 'asking';
}

/** A session, as AGENTS lists it (remote.md §6 `Agent`). */
export interface Session {
  session: string;
  harness: string;
  state: 'running' | 'ended' | 'quiet';
  turn: 'ready' | 'working' | 'waiting' | 'turn_ended' | null;
  title: string | null;
  at: number;
  asks: number;
  agent: string | null;
  ask: Why | null;
}

/** An Eval's round in WORK. */
export interface Round {
  eval: string;
  n: number;
  judging: boolean;
  verdict: 'aligned' | 'drifted' | 'incomplete' | null;
  agreement: string | null;
  asks: Ask[];
  seal: Why | null;
}

/** What a project still needs before RingFrame is set up in it; null where nothing could say. */
export interface Needs {
  ringframe: boolean;
  git: boolean | null;
  commit: boolean | null;
}

/** One project of the tree (remote.md §6), as weft_core::tree builds it. */
export interface Project {
  project: string;
  open: number;
  needs: number;
  ask: Why | null;
  /** Null, or left out, when RingFrame is set up there. */
  setup?: Needs | null;
  /** Agents started here from now on run in turbo mode. */
  turbo?: boolean;
  /** When weftd reopened it after ending uncleanly, until someone acts in it. */
  reopened?: number | null;
  agents: { running: number; ended: number; rows: Session[]; earlier: number };
  work: { open: { since: number | null; asks: Ask[]; eval: Why | null }; evals: Round[]; sealed: { seals: number; asks: number } };
}

/** A harness a project can start. */
export interface Start {
  project: string;
  harness: string;
  title: string;
}

/** The reads' payloads (remote.md §6), as `read` answers them. */
export interface Detail {
  unit: string;
  title: string;
  harness: string;
  crumb: { eval: { eval: string; n: number; verdict: Round['verdict'] } | null; seal: { seal: string; n: number } | null };
  ask: { state: 'DONE' | 'ASKING'; aside: string; lines: string[] };
  session: Session | null;
  proceed: boolean;
  follows: string;
}
export interface EvalDetail {
  eval: string;
  n: number;
  judging: boolean;
  verdict: Round['verdict'];
  agreement: string | null;
  judged_by: string | null;
  at: number | null;
  findings: { mark: string; text: string }[];
  checks: { mark: string; text: string; result: string }[];
  asks: Ask[];
  sealed: { seal: string; n: number } | null;
  seal: Why | null;
}
export interface SealDetail {
  seal: string;
  n: number;
  decision: string;
  at: number | null;
  eval: { eval: string; n: number; verdict: Round['verdict']; agreement: string | null } | null;
  receipt: string;
  holds: boolean | null;
  broken: string[];
  /** Every Ask it covered: the fake pages them, 50 at a time. */
  asks: Ask[];
}
export interface SessionDetail {
  session: string;
  harness: string;
  state: Session['state'];
  turn: Session['turn'];
  started: number;
  last: number;
  resume: boolean;
  /** It runs with no agent of Weft's, and Resume joins it there. */
  joins: boolean;
  asks: { unit: string; title: string; harness: string; word: 'asking' | 'asked' | 'evaled' | 'sealed' | 'cancelled'; eval: number | null; seal: number | null }[];
  agent: string | null;
}
export interface SealRow {
  seal: string;
  n: number;
  decision: string;
  at: number | null;
  eval: number | null;
  asks: number;
}
export interface Earlier {
  session: string;
  harness: string;
  title: string | null;
  asks: number;
  at: number;
  group: 'today' | 'yesterday' | 'week' | 'earlier';
}

/** What the machine answers each read with, by its id; the fake pages the lists, 50 at a time. */
export interface Reads {
  details: Record<string, Detail>;
  evals: Record<string, EvalDetail>;
  seals: Record<string, SealDetail>;
  sessions: Record<string, SessionDetail>;
  /** By project, newest first. */
  sealed: Record<string, SealRow[]>;
  /** By project, newest first: the ended sessions past the tree's. */
  earlier: Record<string, Earlier[]>;
  /** By Eval. */
  views: Record<string, unknown>;
}

const noReads = (): Reads => ({ details: {}, evals: {}, seals: {}, sessions: {}, sealed: {}, earlier: {}, views: {} });

/** How many rows a page holds (remote.md §6). */
export const PAGE = 50;

/** The page after `after` (the first with none), and the `after` of the next page, or null at the end. */
export function page<T>(rows: T[], after: unknown, id: (r: T) => string): { rows: T[]; next: string | null } {
  const at = typeof after === 'string' ? rows.findIndex((r) => id(r) === after) + 1 : 0;
  const start = typeof after === 'string' && at === 0 ? rows.length : at;
  const end = Math.min(start + PAGE, rows.length);
  return { rows: rows.slice(start, end), next: end < rows.length ? id(rows[end - 1]) : null };
}

export class FakeMachine {
  /** The remote protocol's version `weft remote` speaks. */
  static readonly VERSION = 2;
  readonly server: WebSocketServer;
  private readonly tls: Server;
  readonly heard: Record<string, unknown>[] = [];
  epoch = 'e1';
  /** The version this machine speaks: another provokes the page's version refusal. */
  version = FakeMachine.VERSION;
  /** Not signed in to Weft's service: a pair is refused `signed_out`. */
  signedOut = false;
  /** A newer Weft installed and waiting for no agent to run, by its version. */
  update: string | null = null;
  /** It shows a device two agents side by side (`watch` with `also`); an older machine does not. */
  split = true;
  /** The most agents it shows a device at once; a machine that shows two at most leaves it out. */
  panes: number | undefined = 4;
  /** Take connections and never open them: a socket that hangs. */
  hang = false;
  /** Upgrades asked for, answered or not. */
  upgrades = 0;
  /** The upgrades a hang holds, failed when it is released. */
  private held: ((ok: boolean) => void)[] = [];
  vapid: string | null = null;
  agents: Agent[] = [];
  /** The tree; none set, each agent's project and harness with nothing asked. */
  tree: Project[] | null = null;
  harnesses: Start[] = [];
  pendings: Record<string, unknown>[] = [];
  /** Refuse new connections at the upgrade. */
  down = false;
  /** How an `act` is answered; else plain `ok`. */
  onAct: ((m: Record<string, unknown>) => Record<string, unknown>[]) | null = null;
  /** What each read answers from, unless `onRead` says otherwise. */
  reads: Reads = noReads();
  /** How a `read` is answered; else, or where it answers null, from `reads`. */
  onRead: ((m: Record<string, unknown>) => Record<string, unknown> | null) | null = null;
  /** How a `resolve` is answered; else plain `ok`. */
  onResolve: ((m: Record<string, unknown>) => Record<string, unknown>[]) | null = null;
  /** How a `text` is answered; else plain `ok`. */
  onText: ((m: Record<string, unknown>) => Record<string, unknown>) | null = null;
  /** How a `start` is answered; else `ok` with a new agent. */
  onStart: ((m: Record<string, unknown>) => Record<string, unknown>[]) | null = null;
  /** Answer `pair` with `asking`, then `paired` at once. */
  allowAtOnce = true;
  /** Each agent's conversation, by its id; an agent with none cannot be read. */
  conversations: Record<string, Item[]> = {};
  /** The agents each device follows, one to each of its panes, by its socket. */
  private following = new Map<WebSocket, Set<string>>();
  private sockets = new Set<WebSocket>();

  constructor() {
    this.tls = createServer(TLS).listen(0, '127.0.0.1');
    this.server = new WebSocketServer({
      server: this.tls,
      // A hung machine never answers the upgrade; a down one refuses it.
      verifyClient: (_info, done) => {
        this.upgrades++;
        if (this.hang) this.held.push(done);
        else done(!this.down);
      },
    });
    this.server.on('connection', (ws) => {
      this.sockets.add(ws);
      ws.on('close', () => (this.sockets.delete(ws), this.following.delete(ws)));
      ws.on('message', (data) => {
        const m = JSON.parse(String(data));
        this.heard.push(m);
        if (m.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: m.t }));
        if ((m.type === 'hello' || m.type === 'pair') && m.v !== this.version) {
          const newer = typeof m.v === 'number' && m.v > this.version ? 'page' : 'machine';
          ws.send(JSON.stringify({ type: 'refused', code: 'version', newer }));
          ws.close();
          return;
        }
        if (m.type === 'pair' && this.signedOut) {
          ws.send(JSON.stringify({ type: 'refused', code: 'signed_out' }));
          ws.close();
          return;
        }
        if (m.type === 'pair' && this.allowAtOnce) {
          ws.send(JSON.stringify({ type: 'asking' }));
          ws.send(JSON.stringify({ type: 'paired', token: 't_good' }));
        }
        if (m.type === 'hello') {
          if (m.token !== 't_good') {
            ws.send(JSON.stringify({ type: 'refused', code: 'unknown_device' }));
            ws.close();
            return;
          }
          ws.send(JSON.stringify(this.welcome()));
        }
        if (m.type === 'act' && m.act === 'dismiss') {
          // A reopened project dismissed: it closes on the machine.
          this.tree = (this.tree ?? treeOf(this.agents)).filter((p) => p.project !== m.project);
          ws.send(JSON.stringify({ type: 'ok', req: m.req }));
          this.send({ type: 'tree', tree: this.tree });
        } else if (m.type === 'act' && this.onAct) {
          for (const out of this.onAct(m)) ws.send(JSON.stringify(out));
        } else if (m.type === 'read' && m.what === 'conversation' && !this.onRead?.(m)) {
          for (const out of this.conversation(m)) ws.send(JSON.stringify(out));
        } else if (m.type === 'follow') {
          const also: { agent: string }[] = Array.isArray(m.also) ? m.also : [];
          this.following.set(ws, new Set([m.agent, ...also.map((a) => a.agent)].filter((a): a is string => typeof a === 'string')));
        } else if (m.type === 'read') {
          ws.send(JSON.stringify(this.onRead?.(m) ?? this.read(m)));
        } else if (m.type === 'text' && this.onText) {
          ws.send(JSON.stringify(this.onText(m)));
        } else if (m.type === 'resolve' && this.onResolve) {
          for (const o of this.onResolve(m)) ws.send(JSON.stringify(o));
        } else if (m.type === 'start' && m.resume === true) {
          // A resume names a session's id, never "the latest".
          ws.send(JSON.stringify({ type: 'error', req: m.req, code: 'bad_request', message: 'resume names a session' }));
        } else if (m.type === 'start') {
          const out = this.onStart ? this.onStart(m) : [{ type: 'ok', req: m.req, agent: `3f9a1c07b2de-${this.agents.length}` }];
          for (const o of out) ws.send(JSON.stringify(o));
        } else if (typeof m.req !== 'undefined' && ['keys', 'text', 'act', 'resolve', 'read'].includes(m.type)) {
          ws.send(JSON.stringify({ type: 'ok', req: m.req }));
        }
      });
    });
  }

  /** A fake machine, listening. */
  static async start(): Promise<FakeMachine> {
    const m = new FakeMachine();
    if (!m.tls.listening) await new Promise<void>((done) => m.tls.once('listening', () => done()));
    return m;
  }

  get address(): string {
    const a = this.tls.address();
    return `https://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`;
  }

  /** A read, answered from `reads` and the tree as `weft remote` answers it. */
  read(m: Record<string, unknown>): Record<string, unknown> {
    const ok = (what: string, payload: unknown) => ({ type: 'ok', req: m.req, [what]: payload });
    const refused = (code: string) => ({ type: 'error', req: m.req, code, message: `no such ${code.slice(3)}` });
    const r = this.reads;
    switch (m.what) {
      case 'history':
        return { type: 'ok', req: m.req, text: '' };
      case 'detail':
        return r.details[String(m.unit)] ? ok('detail', r.details[String(m.unit)]) : refused('no_unit');
      case 'eval':
        return r.evals[String(m.eval)] ? ok('eval', r.evals[String(m.eval)]) : refused('no_eval');
      case 'eval_view':
        return r.views[String(m.eval)] ? ok('eval_view', r.views[String(m.eval)]) : refused('no_eval');
      case 'seal': {
        const s = r.seals[String(m.seal)];
        if (!s) return refused('no_seal');
        const { rows, next } = page(s.asks, m.after, (a) => a.unit);
        return ok('seal', { ...s, asks: rows, next });
      }
      case 'session': {
        const s = r.sessions[String(m.session)] ?? this.sessionOf(String(m.project), String(m.session));
        return s ? ok('session', s) : refused('no_session');
      }
      case 'sealed': {
        const { rows, next } = page(r.sealed[String(m.project)] ?? [], m.after, (x) => x.seal);
        return ok('sealed', { seals: rows, next });
      }
      case 'sessions': {
        const q = typeof m.q === 'string' ? m.q.toLowerCase() : '';
        const found = (r.earlier[String(m.project)] ?? []).filter((x) => !q || [x.title ?? '', x.harness, x.session].some((t) => t.toLowerCase().includes(q)));
        const { rows, next } = page(found, m.after, (x) => x.session);
        return ok('sessions', { total: found.length, rows, next });
      }
      default:
        return { type: 'ok', req: m.req };
    }
  }

  /**
   * A conversation's page, as `weft remote` answers it (remote.md §6d): the
   * newest 50 items, or those before `before`; a long message in parts, its
   * earlier parts after the `ok`. An agent with no conversation is unreadable.
   */
  conversation(m: Record<string, unknown>): Record<string, unknown>[] {
    const agent = String(m.agent);
    const items = this.conversations[agent];
    if (!this.agents.some((a) => a.agent === agent)) {
      return [{ type: 'error', req: m.req, code: 'no_agent', message: `there is no agent ${agent} here` }];
    }
    if (!items) return [{ type: 'ok', req: m.req, conversation: { readable: false, items: [] } }];
    const end = typeof m.before === 'string' ? Number(m.before.slice(2)) : items.length;
    const start = Math.max(0, end - PAGE);
    const all = pieces(items.slice(start, end));
    const cut = all.findIndex((p) => (p.part ?? 1) === (p.parts ?? 1));
    const later = all.filter((p) => (p.part ?? 1) > 1 && all.indexOf(p) < cut);
    const page = { readable: true, items: all.filter((p) => !later.includes(p)), before: start > 0 ? `c-${start}` : null, after: `c-${items.length}` };
    return [{ type: 'ok', req: m.req, conversation: page }, ...later.map((p) => ({ type: 'conversation', agent, items: [p] }))];
  }

  /** The agent's file grew: every device that follows it is sent the new items. */
  grow(agent: string, items: Item[]): void {
    const all = (this.conversations[agent] ??= []);
    all.push(...items);
    this.toFollowers(agent, { type: 'conversation', agent, items: pieces(items), after: `c-${all.length}` });
  }

  /** The agent's file was replaced: every device that follows it starts over. */
  resetConversation(agent: string, items: Item[] = []): void {
    this.conversations[agent] = items;
    this.toFollowers(agent, { type: 'conversation', agent, reset: true });
  }

  private toFollowers(agent: string, message: Record<string, unknown>): void {
    for (const [ws, followed] of this.following) if (followed.has(agent)) ws.send(JSON.stringify(message));
  }

  /** A session's Details from its tree row, when `reads` holds none. */
  private sessionOf(project: string, session: string): SessionDetail | null {
    const tree = this.tree ?? treeOf(this.agents);
    const earlier = this.reads.earlier[project]?.find((e) => e.session === session);
    const row = tree.find((p) => p.project === project)?.agents.rows.find((s) => s.session === session) ??
      (earlier && { ...earlier, state: 'ended' as const, turn: null, agent: null });
    if (!row) return null;
    return { session, harness: row.harness, state: row.state, turn: row.turn, started: row.at, last: row.at, resume: row.state !== 'running', joins: false, asks: [], agent: row.agent };
  }

  welcome() {
    return {
      type: 'welcome',
      v: this.version,
      epoch: this.epoch,
      machine: { id: 'm_fake', name: 'studio' },
      vapid: this.vapid,
      agents: this.agents,
      tree: this.tree ?? treeOf(this.agents),
      harnesses: this.harnesses,
      pendings: this.pendings,
      update: this.update ? { version: this.update } : null,
      split: this.split,
      ...(this.panes === undefined ? {} : { panes: this.panes }),
    };
  }

  /** No longer hang: the held upgrades fail, as a dead link's do in the end. */
  release(): void {
    this.hang = false;
    for (const done of this.held.splice(0)) done(false);
  }

  /** An update installed and waiting, or none any more: every device is told. */
  setUpdate(version: string | null): void {
    this.update = version;
    this.send({ type: 'update', update: version ? { version } : null });
  }

  /** Send to every connected device. */
  send(message: Record<string, unknown>): void {
    for (const ws of this.sockets) ws.send(JSON.stringify(message));
  }

  /** Drop every connection. */
  drop(): void {
    for (const ws of this.sockets) ws.terminate();
  }

  connections(): number {
    return this.sockets.size;
  }

  of(type: string): Record<string, unknown>[] {
    return this.heard.filter((m) => m.type === type);
  }

  close(): Promise<void> {
    this.drop();
    return new Promise((done) => this.server.close(() => (this.tls.closeAllConnections(), this.tls.close(() => done()))));
  }
}

/** One item of a conversation (remote.md §6d). */
export interface Item {
  id: string;
  kind: 'person' | 'agent' | 'step' | 'outcome';
  at: number | null;
  text?: string;
  tool?: string;
  arg?: string;
  call?: string;
  failed?: boolean;
  part?: number;
  parts?: number;
}

/** The most of an item's text one part holds, as `weft remote` cuts it. */
export const PART = 32 * 1024;

/** Each item, or its parts when its text is longer than `PART`. */
export function pieces(items: Item[]): Item[] {
  return items.flatMap((i) => {
    if (!i.text || i.text.length <= PART) return [i];
    const n = Math.ceil(i.text.length / PART);
    return Array.from({ length: n }, (_, k) => ({ ...i, text: i.text!.slice(k * PART, (k + 1) * PART), part: k + 1, parts: n }));
  });
}

/** A step and its outcome, as a transcript gives them. */
export function step(id: string, tool: string, arg: string, at: number, failed: boolean | null): Item[] {
  const s: Item = { id, kind: 'step', at, tool, arg, call: id };
  return failed === null ? [s] : [s, { id: `${id}.o`, kind: 'outcome', at, call: id, failed }];
}

/**
 * The 12.x cards' sample (M12.1–M12.4, D12.1–D12.3): claude in weft on fix
 * login, its message, its reply, four steps done, then its question. Codex
 * whose turn ended has a failed step and one still running; claude in docs
 * cannot be read.
 */
export function conversations(): Record<string, Item[]> {
  return {
    [CLAUDE]: [
      { id: '0.0', kind: 'person', at: at(11, 20), text: 'Refresh the token before it expires, not after' },
      { id: '1.0', kind: 'agent', at: at(11, 20), text: "I'll update `src/login.rs` so the session token refreshes 60 s before expiry, then run the login tests." },
      ...step('2.0', 'Read', 'src/login.rs', at(11, 21), false),
      ...step('3.0', 'Update', 'src/login.rs', at(11, 22), false),
      ...step('4.0', 'Bash', 'cargo test -p app-core', at(11, 23), false),
      ...step('5.0', 'Bash', 'cargo clippy', at(11, 23), false),
      { id: '6.0', kind: 'agent', at: at(11, 24), text: 'Done. The token now refreshes 60 s early; `cargo test` passes (12 tests). One question: should a failed refresh retry, or sign the person out?' },
    ],
    [CODEX]: [
      { id: '0.0', kind: 'person', at: at(10, 40), text: 'Add a health endpoint' },
      ...step('1.0', 'Ran', 'cargo test health', at(10, 41), true),
      ...step('2.0', 'Edited', 'src/health.rs', at(10, 44), false),
      ...step('3.0', 'Ran', 'cargo test', at(10, 50), null),
      { id: '4.0', kind: 'agent', at: at(10, 52), text: 'Added `GET /health`; the tests are still running.' },
    ],
  };
}

export function agent(n: number, project: string, harness: string, turn: Agent['turn']): Agent {
  return { agent: `3f9a1c07b2de-${n}`, project, harness, title: harness === 'claude-code' ? 'Claude Code' : 'Codex', turn, running: true, since: Date.now() - 120_000 };
}

/** A session row for a tab, as AGENTS lists the session its pane holds. */
export function sessionOf(a: Agent, title: string | null = null): Session {
  return {
    session: `s-${a.agent}`,
    harness: a.harness,
    state: a.running ? 'running' : 'ended',
    turn: a.running ? (a.turn === 'ended' ? 'turn_ended' : a.turn) : null,
    title,
    at: a.since,
    asks: 0,
    agent: a.running ? a.agent : null,
    ask: a.running ? null : { key: 'why.ended', harness: a.harness },
  };
}

/** A project's tree with these sessions and rounds; counts as weft_core::tree makes them. */
export function project(name: string, rows: Session[], work: Partial<Project['work']> = {}, more: Partial<Project> = {}): Project {
  const open = work.open ?? { since: null, asks: [], eval: null };
  return {
    project: name,
    open: open.asks.length,
    needs: rows.filter((r) => r.turn === 'waiting').length,
    ask: null,
    agents: { running: rows.filter((r) => r.state === 'running').length, ended: rows.filter((r) => r.state !== 'running').length, rows, earlier: 0 },
    work: { open, evals: work.evals ?? [], sealed: work.sealed ?? { seals: 0, asks: 0 } },
    ...more,
  };
}

/** A tree of these agents, with nothing asked of any. */
export function treeOf(agents: Agent[]): Project[] {
  const projects = [...new Set(agents.map((a) => a.project))];
  return projects.map((p) => project(p, agents.filter((a) => a.project === p).map((a) => sessionOf(a))));
}

/**
 * The Atlas's sample (M11.1–M11.6, D11.1–D11.6; spec/atlas.md §6): projects
 * weft and docs on studio. In weft, codex at work with no Ask yet, claude
 * needs you on fix login, codex whose turn ended on health endpoint,
 * and three ended sessions, 12 earlier; Open since Eval 3 (fix login,
 * telemetry), Eval 3 aligned and not sealed, Sealed · 4 seals 31. In docs, a
 * claude ready with nothing asked.
 */
export function atlas(): { agents: Agent[]; tree: Project[]; harnesses: Start[]; reads: Reads; conversations: Record<string, Item[]> } {
  const since = Date.now() - 120_000;
  const agents: Agent[] = [
    { agent: CLAUDE, project: 'weft', harness: 'claude', title: 'Claude Code', turn: 'waiting', running: true, since },
    { agent: CODEX, project: 'weft', harness: 'codex', title: 'Codex', turn: 'ended', running: true, since },
    { agent: CODEX_NEW, project: 'weft', harness: 'codex', title: 'Codex', turn: 'working', running: true, since },
    { agent: `${DOCS}-0`, project: 'docs', harness: 'claude', title: 'Claude Code', turn: 'ready', running: true, since },
  ];
  const weft = project('weft', structuredClone(SESSIONS), {
    open: { since: 3, asks: structuredClone(OPEN), eval: null },
    evals: [structuredClone(EVAL_3)],
    sealed: { seals: 4, asks: 31 },
  });
  weft.agents = { running: 3, ended: 15, rows: weft.agents.rows, earlier: 12 };
  const docs = project('docs', [{ ...sessionOf(agents[3]), session: 'd0c5e1a2-0b1c-4d2e-8f3a-4b5c6d7e8f90', at: at(11, 5) }]);
  const harnesses: Start[] = ['weft', 'docs'].flatMap((p) => [
    { project: p, harness: 'claude', title: 'Claude Code' },
    { project: p, harness: 'codex', title: 'Codex' },
  ]);
  return { agents, tree: [weft, docs], harnesses, reads: reads(), conversations: conversations() };
}
