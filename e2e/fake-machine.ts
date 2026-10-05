// A fake machine: speaks the remote protocol (remote.md §6b) as `weft remote`
// does, records every message, and lets a test drop and refuse connections,
// change its epoch and send what the machine would.
import { WebSocketServer, type WebSocket } from 'ws';

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

export interface Work {
  unit: string;
  title: string;
  word: 'asking' | 'asked' | 'evaled' | 'sealed' | 'cancelled';
  turn: Agent['turn'] | null;
  eval: Why | null;
  seal: Why | null;
}

export interface Harness {
  harness: string;
  agent: string | null;
  title: string | null;
  turn: Agent['turn'] | null;
  turbo: boolean;
  running: boolean;
  works: Work[];
}

/** One project's rows of the tree (remote.md §6b), as weft_core::tree builds them. */
export interface Project {
  project: string;
  open: number;
  needs: number;
  ask: Why | null;
  harnesses: Harness[];
}

/** A harness a project can start. */
export interface Start {
  project: string;
  harness: string;
  title: string;
}

export class FakeMachine {
  readonly server: WebSocketServer;
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
  /** How a `read` is answered; else plain `ok`. */
  onRead: ((m: Record<string, unknown>) => Record<string, unknown>) | null = null;
  /** How a `resolve` is answered; else plain `ok`. */
  onResolve: ((m: Record<string, unknown>) => Record<string, unknown>[]) | null = null;
  /** How a `start` is answered; else `ok` with a new agent. */
  onStart: ((m: Record<string, unknown>) => Record<string, unknown>[]) | null = null;
  /** Answer `pair` with `asking`, then `paired` at once. */
  allowAtOnce = true;
  private sockets = new Set<WebSocket>();

  constructor() {
    this.server = new WebSocketServer({
      port: 0,
      host: '127.0.0.1',
      verifyClient: () => !this.down,
    });
    this.server.on('connection', (ws) => {
      this.sockets.add(ws);
      ws.on('close', () => this.sockets.delete(ws));
      ws.on('message', (data) => {
        const m = JSON.parse(String(data));
        this.heard.push(m);
        if (m.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: m.t }));
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
        if (m.type === 'act' && this.onAct) {
          for (const out of this.onAct(m)) ws.send(JSON.stringify(out));
        } else if (m.type === 'read' && this.onRead) {
          ws.send(JSON.stringify(this.onRead(m)));
        } else if (m.type === 'resolve' && this.onResolve) {
          for (const o of this.onResolve(m)) ws.send(JSON.stringify(o));
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
    await new Promise<void>((done) => m.server.once('listening', () => done()));
    return m;
  }

  get address(): string {
    const a = this.server.address();
    return `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`;
  }

  welcome() {
    return {
      type: 'welcome',
      v: 2,
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
    return new Promise((done) => this.server.close(() => done()));
  }
}

export function agent(n: number, project: string, harness: string, turn: Agent['turn']): Agent {
  return { agent: `3f9a1c07b2de-${n}`, project, harness, title: harness === 'claude-code' ? 'Claude Code' : 'Codex', turn, running: true, since: Date.now() - 120_000 };
}

/** A tree of these agents, with nothing asked of any. */
export function treeOf(agents: Agent[]): Project[] {
  const projects = [...new Set(agents.map((a) => a.project))];
  return projects.map((project) => {
    const mine = agents.filter((a) => a.project === project);
    return {
      project,
      open: mine.length,
      needs: mine.filter((a) => a.turn === 'waiting').length,
      ask: null,
      harnesses: mine.map((a) => ({ harness: a.harness, agent: a.running ? a.agent : null, title: a.title, turn: a.running ? a.turn : null, turbo: false, running: a.running, works: [] })),
    };
  });
}

const WEFT = '3f9a1c07b2de';
const DOCS = 'a1b2c3d4e5f6';
const work = (unit: string, title: string, word: Work['word'], turn: Work['turn']): Work => ({ unit, title, word, turn, eval: null, seal: null });

/**
 * The Atlas's sample (spec/atlas.md §6): projects weft and docs on studio;
 * claude, which needs you, and codex in weft; claude in docs; the works fix
 * login, telemetry, health endpoint and readme fix.
 */
export function atlas(): { agents: Agent[]; tree: Project[]; harnesses: Start[] } {
  const since = Date.now() - 120_000;
  const agents: Agent[] = [
    { agent: `${WEFT}-0`, project: 'weft', harness: 'claude', title: 'Claude Code', turn: 'waiting', running: true, since },
    { agent: `${WEFT}-1`, project: 'weft', harness: 'codex', title: 'Codex', turn: 'ended', running: true, since },
    { agent: `${DOCS}-0`, project: 'docs', harness: 'claude', title: 'Claude Code', turn: 'ready', running: true, since },
  ];
  const tree: Project[] = [
    {
      project: 'weft',
      open: 2,
      needs: 1,
      ask: null,
      harnesses: [
        { harness: 'claude', agent: `${WEFT}-0`, title: 'Claude Code', turn: 'waiting', turbo: false, running: true,
          works: [work('ask_1', 'fix login', 'asked', 'waiting'), work('ask_2', 'telemetry', 'asking', null)] },
        { harness: 'codex', agent: `${WEFT}-1`, title: 'Codex', turn: 'ended', turbo: false, running: true,
          works: [work('ask_3', 'health endpoint', 'evaled', 'ended'), work('ask_4', 'readme fix', 'sealed', null)] },
      ],
    },
    {
      project: 'docs',
      open: 1,
      needs: 0,
      ask: null,
      harnesses: [{ harness: 'claude', agent: `${DOCS}-0`, title: 'Claude Code', turn: 'ready', turbo: false, running: true, works: [] }],
    },
  ];
  const harnesses: Start[] = ['weft', 'docs'].flatMap((project) => [
    { project, harness: 'claude', title: 'Claude Code' },
    { project, harness: 'codex', title: 'Codex' },
  ]);
  return { agents, tree, harnesses };
}
