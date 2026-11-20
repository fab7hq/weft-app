// What an Eval will read, as its dialog says it: the commits and files since
// its first Ask or its last Seal, what is counted and not read, and, for a
// large change, where most of it is and what makes the next one smaller.
import { anyLeft, type Finding } from './skip';
import { fill, w } from './words';

/** The Eval dialog's `reads`, as the machine sends it. */
export interface Reads {
  since: 'ask' | 'seal';
  /** RFC 3339. */
  when: string;
  commits: number;
  files: number;
  /** Files counted, not read, by kind: generated, vendored, binary, lock. */
  skipped?: Record<string, number>;
  /** The folder most of it is in, and how many files it holds. */
  folder?: string;
  folder_files?: number;
  large?: boolean;
  /** What an Eval should skip in its work's range, nested repositories included; those whose line was taken first. */
  findings?: Finding[];
  /** What `files` was when the dialog was made, once a line taken moved it. */
  files_before?: number;
}

/** The pendings held, with this one in place of any held under its id: an
 * Eval dialog is sent again each time a line is taken. */
export function withPending<P extends { id: string }>(held: P[], p: P): P[] {
  return [...held.filter((h) => h.id !== p.id), p];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DAY = 24 * 60 * 60 * 1000;

/** A time as a sentence says it, on this device's clock: `today 09:12`, `yesterday 18:40`, `Nov 8`, `Nov 8 2025`. */
export function whenWords(when: string, now: number = Date.now(), offset: number = -new Date(now).getTimezoneOffset() * 60_000): string {
  const at = Date.parse(when);
  if (Number.isNaN(at)) return when;
  const local = new Date(at + offset);
  const today = new Date(now + offset);
  const days = Math.floor((now + offset) / DAY) - Math.floor((at + offset) / DAY);
  if (days <= 1) {
    const time = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
    const said = fill(days <= 0 ? 'time.today' : 'time.yesterday', { time });
    // Mid-sentence: `since its first Ask, today 09:12`.
    return said.charAt(0).toLowerCase() + said.slice(1);
  }
  const date = `${MONTHS[local.getUTCMonth()]} ${local.getUTCDate()}`;
  return local.getUTCFullYear() === today.getUTCFullYear() ? date : `${date} ${local.getUTCFullYear()}`;
}

const num = (n: number) => n.toLocaleString('en-US');

/** The Reads row: `3 commits · 14 files`, `since its first Ask, today 09:12`,
 * and what is counted, not read, if any: `2 counted, not read: 1 generated, 1 binary`.
 * Once a line taken moved the count, `before` is what it was, struck out before it. */
export function readsRow(r: Reads, now?: number, offset?: number): { what: string; commits: string; files: string; before: string | null; since: string; skipped: string | null } {
  const commits = r.commits === 1 ? w('reads.one_commit') : fill('reads.commits', { n: num(r.commits) });
  const files = r.files === 1 ? w('reads.one_file') : fill('reads.files', { n: num(r.files) });
  const before = r.files_before !== undefined && r.files_before !== r.files ? num(r.files_before) : null;
  const since = fill(r.since === 'seal' ? 'reads.since_seal' : 'reads.since_ask', { when: whenWords(r.when, now, offset) });
  const kinds = Object.entries(r.skipped ?? {}).filter(([, n]) => n > 0);
  const total = kinds.reduce((sum, [, n]) => sum + n, 0);
  const skipped = total > 0 ? fill('reads.skipped', { n: num(total), kinds: kinds.map(([k, n]) => fill(`reads.${k}`, { n: num(n) })).join(', ') }) : null;
  return { what: `${commits} · ${files}`, commits, files, before, since, skipped };
}

/** A large change's note: its title, where most of it is (the folder apart, to set it in mono), and what to do.
 * While a finding's line is still to take, the findings say what to do in its place. */
export function largeNote(r: Reads, now?: number, offset?: number): { title: string; where: [string, string, string] | null; fix: string } | null {
  if (!r.large || anyLeft(r.findings ?? [])) return null;
  let where: [string, string, string] | null = null;
  if (r.folder) {
    const said = fill('reads.large_where', { when: whenWords(r.when, now, offset), n: num(r.folder_files ?? 0) });
    const at = said.indexOf('{folder}');
    where = at < 0 ? [said, '', ''] : [said.slice(0, at), r.folder, said.slice(at + '{folder}'.length)];
  }
  return { title: w('reads.large_title'), where, fix: w('reads.large_fix') };
}
