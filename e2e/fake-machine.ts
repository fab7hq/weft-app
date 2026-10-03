// A fake machine: speaks the remote protocol (remote.md §6) as `weft remote`
// does, records every message, and lets a test drop and refuse connections,
// change its epoch and send what the machine would.
import { WebSocketServer, type WebSocket } from 'ws';

export interface Agent {
  agent: string;
  project: string;
  harness: string;
  title: string;
  turn: 'ready' | 'working' | 'waiting' | 'ended';
  since: number;
  unit?: { id: string; title: string; eval: string | null };
}

export class FakeMachine {
  readonly server: WebSocketServer;
  readonly heard: Record<string, unknown>[] = [];
  epoch = 'e1';
  vapid: string | null = null;
  agents: Agent[] = [];
  pendings: Record<string, unknown>[] = [];
  /** Refuse new connections at the upgrade. */
  down = false;
  /** How an `act` is answered; else plain `ok`. */
  onAct: ((m: Record<string, unknown>) => Record<string, unknown>[]) | null = null;
  /** How a `read` is answered; else plain `ok`. */
  onRead: ((m: Record<string, unknown>) => Record<string, unknown>) | null = null;
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
      v: 1,
      epoch: this.epoch,
      machine: { id: 'm_fake', name: 'studio' },
      vapid: this.vapid,
      agents: this.agents,
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
  return { agent: `3f9a1c07b2de-${n}`, project, harness, title: harness === 'claude-code' ? 'Claude Code' : 'Codex', turn, since: Date.now() - 120_000 };
}
