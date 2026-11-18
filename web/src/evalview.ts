// The Eval view as the machine sends it (`read eval_view`): one item per line,
// what to look at first, then what is settled. What an item means is the
// machine's; here each kind gets its one mark and colour, and the view knows
// which item is chosen and where it stands among the others.
import type { Ask, Report, Why } from './machine';
import type { Progress } from './progress';

export type Kind = 'before' | 'look' | 'unsettled' | 'settled';

/** What one read said of an item. */
export interface Read {
  who: string;
  said: string;
}

export interface Item {
  key: string;
  kind: Kind;
  /** The line in the list. */
  text: string;
  count: number;
  /** One per read, filled when that read agrees. */
  dots: boolean[];
  /** It is being read again: no dots yet. */
  again: boolean;
  /** The detail's first line, after the mark. */
  head: string;
  big: string;
  why: string[];
  /** How sure, beside the dots. */
  sure: string;
  /** What the agent said of it, in its own words. */
  said: string | null;
  /** What would settle it. */
  check: string | null;
  /** The changes whose lines show it. */
  windows: string[];
  reads: Read[];
}

export interface Line {
  n: number | null;
  text: string;
  /** A read quoted it. */
  lit: boolean;
}

export interface Lines {
  path: string;
  lines: Line[];
}

export interface Payload {
  eval_id: string;
  title: string;
  closed: boolean;
  headline: string;
  /** While it runs, before the first read is in. */
  waiting: boolean;
  items: Item[];
  lines: Record<string, Lines>;
  progress: Progress | null;
}

/** Each kind's shape. */
export const MARK: Record<Kind, string> = { before: '↺', look: '■', unsettled: '◆', settled: '●' };

/** Each kind's colour, a `--fab7-` token: on its mark and its dots, never on a whole line. */
export const COLOUR: Record<Kind, string> = { before: 'teal', look: 'amber', unsettled: 'accent', settled: 'muted' };

/** The style that colours a kind's mark and dots. */
export const tint = (k: Kind) => ({ '--c': `var(--fab7-${COLOUR[k]})` });

export const toLookAt = (k: Kind) => k !== 'settled';

/** What to look at, then what is settled, each in the order sent. */
export function sections(items: Item[]): { look: Item[]; settled: Item[] } {
  return { look: items.filter((i) => toLookAt(i.kind)), settled: items.filter((i) => !toLookAt(i.kind)) };
}

/** The item asked for, else the first. */
export function chosen(items: Item[], key?: string): Item | null {
  return items.find((i) => i.key === key) ?? items[0] ?? null;
}

/** Where an item stands: one to look at among those to look at, a settled one among all. */
export function place(items: Item[], item: Item): { k: number; n: number } {
  const among = toLookAt(item.kind) ? items.filter((i) => toLookAt(i.kind)) : items;
  return { k: among.findIndex((i) => i.key === item.key) + 1, n: among.length };
}

/** What a line shows at its end: its dots, that it is being read again, or nothing. */
export function aside(item: Item): { dots: boolean[] } | { again: true } | null {
  if (item.again) return { again: true };
  return item.dots.length > 0 ? { dots: item.dots } : null;
}

/** The view's pages, by the place its address holds. */
export type Page = { name: 'list' } | { name: 'item'; key: string } | { name: 'lines'; key: string };

export const toItem = (key: string) => `i:${key}`;
export const toLines = (key: string) => `l:${key}`;

export function pageOf(at: string | undefined): Page {
  if (at?.startsWith('i:')) return { name: 'item', key: at.slice(2) };
  if (at?.startsWith('l:')) return { name: 'lines', key: at.slice(2) };
  return { name: 'list' };
}

/** The lines of each change an item points at, those the machine sent. */
export function windowsOf(v: Payload, item: Item): Lines[] {
  return item.windows.flatMap((id) => (v.lines[id] ? [v.lines[id]] : []));
}

/** An Eval's Details (`read eval`). */
export interface EvalDetail {
  eval: string;
  n: number;
  judging: boolean;
  report: Report | null;
  /** Each harness that read it and its model. */
  judged_by: string | null;
  at: number | null;
  /** `5 things to look at · 12 settled`, once its record is in. */
  headline: string | null;
  items: Item[];
  /** How many questions its Seal asks. */
  questions: number;
  checks: { mark: string; text: string; result: string }[];
  asks: Ask[];
  sealed: { seal: string; n: number } | null;
  seal: Why | null;
}
