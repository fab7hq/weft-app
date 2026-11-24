// The person's decisions, as a project's settings list them: each answer
// given at a Seal, newest first, in its answer's colour, with its day and the
// files it is about. The machine sends them worded; here a row is split into
// what is set in mono. Nothing in it acts.
import type { Tone } from './answering';
import { w } from './words';

/** One decision, as its row says it. */
export interface Decision {
  id: string;
  behaviour: string;
  /** `wanted`, `not_wanted`, `now`, `later`, `drop`, `words` or `not_sure`. */
  answer: string;
  /** `Wanted`, `Not wanted`, … */
  answer_words: string;
  /** `teal`, `amber`, `blue` or `grey`, as the Seal's answers. */
  tone: string;
  /** `3 Nov`. */
  day: string;
  /** The files it is about. */
  files: string[];
  /** A file it is about has changed since. */
  stale: boolean;
  /** `src/session.rs has changed since; the next Eval that touches it asks again`, when stale. */
  stale_line?: string | null;
}

/** The section: its title, how many, the mark a stale one carries, and the decisions. */
export interface Decisions {
  title: string;
  /** `4 · 1 to ask again`, or `4`. */
  count: string;
  /** `changed since`. */
  changed: string;
  list: Decision[];
}

/** A piece of a row's second line; `mono` for a file. */
export interface Part {
  text: string;
  mono?: boolean;
}

const TONES: Tone[] = ['teal', 'amber', 'blue', 'grey'];

/** A decision's colour, on the answers' scale; grey for one the machine names no colour for. */
export const toneOf = (d: Decision): Tone => (TONES.includes(d.tone as Tone) ? (d.tone as Tone) : 'grey');

/** Files, each in mono, joined by `, `. */
function filesParts(files: string[]): Part[] {
  return files.flatMap((f, i) => (i > 0 ? [{ text: ', ' }, { text: f, mono: true }] : [{ text: f, mono: true }]));
}

/** A stale line with its files in mono, found by the words it was made from; as it is when it matches neither. */
export function staleParts(line: string): Part[] {
  for (const key of ['decisions.stale', 'decisions.stale_n']) {
    const said = w(key);
    const at = said.indexOf('{files}');
    if (at < 0) continue;
    const [before, after] = [said.slice(0, at), said.slice(at + '{files}'.length)];
    if (line.length > before.length + after.length && line.startsWith(before) && line.endsWith(after)) {
      const files = line.slice(before.length, line.length - after.length).split(', ');
      return [...(before ? [{ text: before }] : []), ...filesParts(files), ...(after ? [{ text: after }] : [])];
    }
  }
  return [{ text: line }];
}

/** What follows a row's answer: ` · 3 Nov · src/login.rs, AGENTS.md`, or, when stale, ` · 3 Nov · src/session.rs has changed since; …`. */
export function rowParts(d: Decision): Part[] {
  const after = d.stale && d.stale_line ? staleParts(d.stale_line) : filesParts(d.files);
  return [{ text: ` · ${d.day}` }, ...(after.length ? [{ text: ' · ' }, ...after] : [])];
}

/** The section to show: none until it is read, or when there are no decisions. */
export const shown = (d: Decisions | null | undefined): Decisions | null => (d && d.list.length > 0 ? d : null);
