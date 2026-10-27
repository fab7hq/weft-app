// Done: every sealed unit of a project, as weft-core's `done` lists it, parked
// first. The machine narrows it by the search; this only reads it and says a row.
import { clock } from './bar';

/** One sealed unit, in the words a person reads. */
export interface Done {
  unit: string;
  title: string;
  harness: string;
  verdict: string | null;
  decision: string;
  reason: string | null;
  at: string;
  parked: boolean;
}

/** The read of a project's Done list: narrowed by `q`, from `after` on. */
export function doneRead(project: string, q: string, after: string | null): Record<string, unknown> {
  const said = q.trim();
  return { type: 'read', what: 'done', project, ...(said ? { q: said } : {}), ...(after ? { after } : {}) };
}

/** A row's second line: what was decided, why, and the verdict it was sealed on. */
export function doneLine(d: Done): string {
  return [d.decision, d.reason, d.verdict].filter((p): p is string => !!p).join(' · ');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** When a row was sealed, as the list says it: the time today, else the month and day (`Oct 24`), of the record's UTC day. */
export function sealedWhen(at: string, now: number = Date.now()): string {
  const t = Date.parse(at);
  if (Number.isNaN(t)) return at;
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const d = new Date(t);
  return day(t) === day(now) ? clock(t) : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
