// An agent's conversation as the machine sends it (remote.md §6d), made into
// what Conversation draws (web-app.md §4, M12.x, D12.x): the person's
// messages, the agent's replies, and the tool steps between two of them as
// one group. Kept in memory while it is shown, and nowhere else.

/** One item, as the machine sends it. */
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

export type Step = { tool: string; arg: string; state: 'done' | 'failed' | 'running' };

/** What is drawn: a message, or the steps between two messages. */
export type Row =
  | { kind: 'person' | 'agent'; id: string; text: string; at: number | null }
  | { kind: 'steps'; id: string; steps: Step[] };

/**
 * The items held, by id, in the file's order: a page read earlier goes
 * before them, what the file added after. A message sent in parts is held
 * whole once every part is in; an item the device holds is replaced by one
 * with the same id.
 */
export class Held {
  private items = new Map<string, Item>();
  private parts = new Map<string, Item[]>();

  /** Items from a page older than those held. */
  before(items: Item[]): void {
    const older = new Map<string, Item>();
    for (const i of this.whole(items)) older.set(i.id, i);
    for (const [id, i] of this.items) if (!older.has(id)) older.set(id, i);
    this.items = older;
  }

  /** Items the file added, or the newest page. */
  after(items: Item[]): void {
    for (const i of this.whole(items)) this.items.set(i.id, i);
  }

  clear(): void {
    this.items.clear();
    this.parts.clear();
  }

  all(): Item[] {
    return [...this.items.values()];
  }

  /** Each item, or nothing until all of a message's parts are in. */
  private whole(items: Item[]): Item[] {
    const out: Item[] = [];
    for (const i of items) {
      if (!i.parts || i.parts < 2) {
        out.push(i);
        continue;
      }
      const got = [...(this.parts.get(i.id) ?? []).filter((p) => p.part !== i.part), i];
      if (got.length < i.parts) {
        this.parts.set(i.id, got);
        continue;
      }
      this.parts.delete(i.id);
      got.sort((a, b) => (a.part ?? 0) - (b.part ?? 0));
      const { part: _, parts: __, ...first } = got[0];
      out.push({ ...first, text: got.map((p) => p.text ?? '').join('') });
    }
    return out;
  }
}

/** The rows these items draw: each step settled by its own entry or by an outcome naming its call. */
export function rows(items: Item[]): Row[] {
  const outcome = new Map<string, boolean>();
  for (const i of items) if (i.kind === 'outcome' && i.call) outcome.set(i.call, Boolean(i.failed));
  const out: Row[] = [];
  for (const i of items) {
    if (i.kind === 'person' || i.kind === 'agent') {
      if (i.text) out.push({ kind: i.kind, id: i.id, text: i.text, at: i.at });
      continue;
    }
    if (i.kind !== 'step') continue;
    const failed = i.failed ?? (i.call ? outcome.get(i.call) : undefined);
    const step: Step = { tool: i.tool ?? '', arg: i.arg ?? '', state: failed === undefined ? 'running' : failed ? 'failed' : 'done' };
    const last = out.at(-1);
    if (last?.kind === 'steps') last.steps.push(step);
    else out.push({ kind: 'steps', id: i.id, steps: [step] });
  }
  return out;
}

/** A message's text, its `code` spans apart. */
export function spans(text: string): { code: boolean; text: string }[] {
  return text.split('`').map((t, n) => ({ code: n % 2 === 1, text: t })).filter((s) => s.text !== '');
}
