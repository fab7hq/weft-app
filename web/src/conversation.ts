// An agent's conversation as the machine sends it (remote.md §6d), made into
// what Conversation draws (web-app.md §4, M12.x, D12.x): the person's
// messages, the agent's replies, and the tool steps between two of them as
// one group. Kept in memory while it is shown, and nowhere else.
import { type Ref, union } from './viewer/kinds';

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
  /** The files a message named, or the file a step wrote. */
  refs?: Ref[];
}

export type Step = { tool: string; arg: string; state: 'done' | 'failed' | 'running' };

/** What is drawn: a message, or the steps between two messages. */
export type Row =
  | { kind: 'person' | 'agent'; id: string; text: string; at: number | null; refs?: Ref[] }
  /** `refs`: every file the steps wrote, each once. */
  | { kind: 'steps'; id: string; steps: Step[]; refs?: Ref[] };

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
      if (i.text) out.push({ kind: i.kind, id: i.id, text: i.text, at: i.at, ...(i.refs?.length ? { refs: union([i.refs]) } : {}) });
      continue;
    }
    if (i.kind !== 'step') continue;
    const failed = i.failed ?? (i.call ? outcome.get(i.call) : undefined);
    const step: Step = { tool: i.tool ?? '', arg: i.arg ?? '', state: failed === undefined ? 'running' : failed ? 'failed' : 'done' };
    let group = out.at(-1);
    if (group?.kind !== 'steps') {
      group = { kind: 'steps', id: i.id, steps: [] };
      out.push(group);
    }
    group.steps.push(step);
    if (i.refs?.length) group.refs = union([group.refs, i.refs]);
  }
  return out;
}

/** A message's text, its `code` spans apart. */
export function spans(text: string): { code: boolean; text: string }[] {
  return text.split('`').map((t, n) => ({ code: n % 2 === 1, text: t })).filter((s) => s.text !== '');
}

/** A row as drawn: its item's id, and its top and bottom in the scroll's content. */
export type Laid = { id: string; top: number; bottom: number };

/** Where a conversation was left: the first row still in sight and its top
 * against the view's, or null at its end. */
export type Place = { id: string; dy: number; last?: string } | null;

/** `last`: the newest item held, by which a replaced file is known. */
export function placeOf(laid: Laid[], scrollTop: number, atEnd: boolean, last?: string): Place {
  if (atEnd) return null;
  const first = laid.find((r) => r.bottom > scrollTop);
  return first ? { id: first.id, dy: first.top - scrollTop, ...(last && { last }) } : null;
}

/** The scroll that shows `place` again, or undefined while its row is not read. */
export function scrollFor(place: { id: string; dy: number }, laid: Laid[]): number | undefined {
  const row = laid.find((r) => r.id === place.id);
  return row ? row.top - place.dy : undefined;
}

/** An item's id as its place in the file: its line's byte offset, then its place in the line. */
const order = (id: string): [number, number] => {
  const [line, part] = id.split('.').map(Number);
  return [line, part ?? 0];
};

const before = (a: string, b: string): boolean => {
  const [[l, p], [m, q]] = [order(a), order(b)];
  return l < m || (l === m && p < q);
};

/** Whether the place's message is gone, the file replaced: one from before
 * it is read and it is not, or all that is read is older than the newest
 * item it held (a file only grows). Older pages cannot bring it back. */
export function gone(place: { id: string; last?: string }, ids: string[]): boolean {
  if (ids.includes(place.id)) return false;
  const { last } = place;
  if (last && ids.length > 0 && ids.every((id) => before(id, last))) return true;
  return ids.some((id) => before(id, place.id));
}
