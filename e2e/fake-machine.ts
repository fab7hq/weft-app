// A fake machine: speaks the remote protocol, version 3 (remote.md §6c), as
// `weft remote` does, answers each read from its sample a page at a time,
// records every message, and lets a test drop and refuse connections, change
// its epoch and send what the machine would.
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

/** A session, as AGENTS lists it (remote.md §6c `Agent`). */
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

/** One project of the tree (remote.md §6c), as weft_core::tree builds it. */
export interface Project {
  project: string;
  open: number;
  needs: number;
  ask: Why | null;
  /** Null, or left out, when RingFrame is set up there. */
  setup?: Needs | null;
  /** Agents started here from now on run in turbo mode. */
  turbo?: boolean;
  agents: { running: number; ended: number; rows: Session[]; earlier: number };
  work: { open: { since: number | null; asks: Ask[]; eval: Why | null }; evals: Round[]; sealed: { seals: number; asks: number } };
}

/** A harness a project can start. */
export interface Start {
  project: string;
  harness: string;
  title: string;
}

/** The reads' payloads (remote.md §6c), as `read` answers them. */
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

/** How many rows a page holds (remote.md §6c). */
export const PAGE = 50;

/** The page after `after` (the first with none), and the `after` of the next page, or null at the end. */
export function page<T>(rows: T[], after: unknown, id: (r: T) => string): { rows: T[]; next: string | null } {
  const at = typeof after === 'string' ? rows.findIndex((r) => id(r) === after) + 1 : 0;
  const start = typeof after === 'string' && at === 0 ? rows.length : at;
  const end = Math.min(start + PAGE, rows.length);
  return { rows: rows.slice(start, end), next: end < rows.length ? id(rows[end - 1]) : null };
}

export class FakeMachine {
  readonly server: WebSocketServer;
  private readonly tls: Server;
  readonly heard: Record<string, unknown>[] = [];
  epoch = 'e1';
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
  private sockets = new Set<WebSocket>();

  constructor() {
    this.tls = createServer(TLS).listen(0, '127.0.0.1');
    this.server = new WebSocketServer({ server: this.tls, verifyClient: () => !this.down });
    this.server.on('connection', (ws) => {
      this.sockets.add(ws);
      ws.on('close', () => this.sockets.delete(ws));
      ws.on('message', (data) => {
        const m = JSON.parse(String(data));
        this.heard.push(m);
        if (m.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: m.t }));
        if (m.type === 'pair' && this.allowAtOnce && m.v === 3) {
          ws.send(JSON.stringify({ type: 'asking' }));
          ws.send(JSON.stringify({ type: 'paired', token: 't_good' }));
        }
        if ((m.type === 'hello' || m.type === 'pair') && m.v !== 3) {
          ws.send(JSON.stringify({ type: 'refused', code: 'version' }));
          ws.close();
          return;
        }
        if (m.type === 'hello') {
          if (m.token !== 't_good') {
            ws.send(JSON.stringify({ type: 'refused', code: 'unknown_device' }));
            ws.close();
            return;
          }
          ws.send(JSON.stringify(this.welcome()));
        }
        if (m.type === 'act' && this.onAct) {
          for (const out of this.onAct(m)) ws.send(JSON.stringify(out));
        } else if (m.type === 'read') {
          ws.send(JSON.stringify(this.onRead?.(m) ?? this.read(m)));
        } else if (m.type === 'text' && this.onText) {
          ws.send(JSON.stringify(this.onText(m)));
        } else if (m.type === 'resolve' && this.onResolve) {
          for (const o of this.onResolve(m)) ws.send(JSON.stringify(o));
        } else if (m.type === 'start' && (m.resume === true || 'unit' in m)) {
          // Version 2's resume and start {unit} are gone.
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

  /** A session's Details from its tree row, when `reads` holds none. */
  private sessionOf(project: string, session: string): SessionDetail | null {
    const tree = this.tree ?? treeOf(this.agents);
    const earlier = this.reads.earlier[project]?.find((e) => e.session === session);
    const row = tree.find((p) => p.project === project)?.agents.rows.find((s) => s.session === session) ??
      (earlier && { ...earlier, state: 'ended' as const, turn: null, agent: null });
    if (!row) return null;
    return { session, harness: row.harness, state: row.state, turn: row.turn, started: row.at, last: row.at, resume: row.state !== 'running', asks: [], agent: row.agent };
  }

  welcome() {
    return {
      type: 'welcome',
      v: 3,
      epoch: this.epoch,
      machine: { id: 'm_fake', name: 'studio' },
      vapid: this.vapid,
      agents: this.agents,
      tree: this.tree ?? treeOf(this.agents),
      harnesses: this.harnesses,
      pendings: this.pendings,
    };
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
export function atlas(): { agents: Agent[]; tree: Project[]; harnesses: Start[]; reads: Reads } {
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
  return { agents, tree: [weft, docs], harnesses, reads: reads() };
}
