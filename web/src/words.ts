// The words this app shares with Weft's desktop app, by key, from /words.json: its
// language pack, fetched at start and never cached, so a replaced file shows
// on the next refresh. Words only the web app has stay where they are used.
import type { Status } from './machine';

let table: Record<string, string> = {};

/** Fetch the words before the first screen. */
export async function load(): Promise<void> {
  try {
    const r = await fetch('/words.json', { cache: 'no-cache' });
    if (r.ok) table = await r.json();
  } catch {
    // No network: the app opens to No connection, which says nothing shared.
  }
}

/** Use these words: for tests. */
export function use(words: Record<string, string>): void {
  table = words;
}

/** The word for a key; the key itself when the pack does not hold it. */
export function w(key: string): string {
  return table[key] ?? key;
}

/** A sentence with each `{name}` it holds filled. */
export function fill(key: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((s, [name, value]) => s.replaceAll(`{${name}}`, value), w(key));
}

/** A turn: a tab's (`ended`, its turn) or a session's (`turn_ended`), both said "turn ended". */
export type Turn = 'ready' | 'working' | 'waiting' | 'ended' | 'turn_ended';
export type Word = 'asking' | 'asked' | 'evaled' | 'sealed' | 'cancelled';

export const turnWord = (t: Turn) => w(`turn.${t === 'ended' ? 'turn_ended' : t}`);
export const stateWord = (s: Word) => w(`word.${s}`);

/** An agreement as the record writes it: `0.67`, `1.0`. */
export function score(v: number): string {
  const two = v.toFixed(2);
  return two.endsWith('0') ? two.slice(0, -1) : two;
}

/** A Seal's decision as a person reads it. */
export const decision = (d: string) => (d === 'deferred' ? 'parked' : d === 'abandoned' ? 'dropped' : d);

/** A unit of work's status as its row says it: asked, eval open, drifted · 0.75, sealed · accepted. */
export function statusWord(s: Status): string {
  switch (s.state) {
    case 'asking':
    case 'asked':
      return w(`work.${s.state}`);
    case 'judging':
      return w('work.eval_open');
    case 'judged': {
      const said = fill('work.judged', { verdict: w(`verdict.${s.verdict}`), agreement: s.agreement === null ? '' : score(s.agreement) });
      return said.endsWith(' · ') ? said.slice(0, -3) : said;
    }
    case 'sealed':
      return fill('work.sealed', { decision: decision(s.decision) });
  }
}

/** The tone a status is said in: teal aligned, amber drifted or short of proof, blue an Eval open, faint sealed. */
export function statusTone(s: Status): string {
  switch (s.state) {
    case 'judged':
      return s.verdict === 'aligned' ? 'good' : 'needs';
    case 'judging':
      return 'blue';
    case 'sealed':
      return 'faint';
    default:
      return '';
  }
}
/** An Eval step's state; a reading in progress is "met, so far". */
export const evalState = (s: string | { read: string }) =>
  typeof s === 'string' ? w(`eval.${s}`) : fill('eval.so_far', { state: s.read.replaceAll('_', ' ') });
