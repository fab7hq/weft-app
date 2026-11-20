// What the machine is doing that takes a while, as it last said: each job's
// steps, how far along it is, and how it ended. A job is matched to what this
// device shows by the request that began it, or by what it is about. Times
// are this device's own: a job began `age_ms` before it was heard.
import { signal } from '@preact/signals';
import { elapsed } from './waits';
import { fill } from './words';

export type StepState = 'done' | 'now' | 'next' | 'failed' | 'skipped';

/** One step, in words a person reads: its words key and their values, its
 * state, the time it took or has taken, and a count where one is known. */
export interface Step {
  key: string;
  args?: Record<string, string>;
  state: StepState;
  ms?: number;
  done?: number;
  total?: number;
  unit?: string;
}

/** What a job is about; each part only when it has one. */
export interface On {
  work?: string;
  ask?: string;
  eval?: string;
  seal?: string;
  pane?: number;
  harness?: string;
}

export interface Job {
  id: string;
  kind: string;
  on: On;
  steps: Step[];
  /** How much is done, 0 to 1, when the machine can tell. */
  share?: number;
  age_ms: number;
  end?: { ok: boolean; why?: string };
}

/** A job as this device holds it: its project, the request of this device's
 * that began it, when it began and when it was last heard, by this device's
 * clock; `stale` while a welcome has not said it again. */
export interface Held extends Job {
  project: string;
  req?: number;
  since: number;
  heard: number;
  stale?: boolean;
}

/** How long a job that ended well is kept after its end was heard. */
export const KEEP_ENDED = 5_000;

/** Every job heard, by its id. */
export const jobs = signal<Record<string, Held>>({});

/** A job as the machine sent it, held: what was known of it before stays (the request, when it began). */
function hold(raw: Record<string, unknown>, project: string, req: number | undefined, now: number): Held | null {
  if (!raw || typeof raw.id !== 'string') return null;
  const job = raw as unknown as Job;
  const had = jobs.value[job.id];
  const age = Number(job.age_ms) || 0;
  return {
    ...job,
    on: job.on ?? {},
    steps: Array.isArray(job.steps) ? job.steps : [],
    project: project || had?.project || '',
    req: req ?? had?.req,
    since: had && !had.stale ? had.since : now - age,
    heard: now,
  };
}

/** Jobs that ended well some time ago are let go. */
function pruned(all: Record<string, Held>, now: number): Record<string, Held> {
  const kept: Record<string, Held> = {};
  for (const [id, j] of Object.entries(all)) if (!(j.end?.ok && now - j.heard > KEEP_ENDED)) kept[id] = j;
  return kept;
}

/** A job moved (`progress`): it is held as it now stands. */
export function heardProgress(msg: Record<string, unknown>, now = Date.now()): Held | null {
  const req = typeof msg.req === 'number' ? msg.req : undefined;
  const h = hold(msg.job as Record<string, unknown>, String(msg.project ?? ''), req, now);
  if (!h) return null;
  jobs.value = pruned({ ...jobs.value, [h.id]: h }, now);
  return h;
}

/** Every job of one project, said again after a welcome (`jobs`): they take
 * the place of those held for it. */
export function heardJobs(msg: Record<string, unknown>, now = Date.now()): Held[] {
  const project = String(msg.project ?? '');
  const list = Array.isArray(msg.jobs) ? (msg.jobs as Record<string, unknown>[]) : [];
  const told = list.map((j) => hold(j, project, undefined, now)).filter((h): h is Held => !!h);
  const kept: Record<string, Held> = {};
  for (const [id, j] of Object.entries(jobs.value)) if (j.project !== project) kept[id] = j;
  for (const h of told) kept[h.id] = h;
  jobs.value = pruned(kept, now);
  return told;
}

/** The machine welcomed this device again: every job held waits to be said again. */
export function welcomed(): void {
  const all: Record<string, Held> = {};
  for (const [id, j] of Object.entries(jobs.value)) all[id] = { ...j, stale: true };
  jobs.value = all;
}

/** What was not said again since the welcome has ended: it is let go. */
export function notToldAgain(): void {
  const kept: Record<string, Held> = {};
  for (const [id, j] of Object.entries(jobs.value)) if (!j.stale) kept[id] = j;
  jobs.value = kept;
}

/** The person acted on a failed job: it is let go. */
export function letGo(id: string): void {
  if (!jobs.value[id]) return;
  const { [id]: _gone, ...rest } = jobs.value;
  jobs.value = rest;
}

const running = (j: Held) => !j.end;

/** The job this device's request began, while it runs. */
export function byReq(req: number | undefined): Held | null {
  if (req === undefined) return null;
  return Object.values(jobs.value).find((j) => j.req === req && running(j)) ?? null;
}

/** The newest running job of a project about `on`, of one of `kinds` if given. */
export function byOn(project: string, on: On, kinds?: string[]): Held | null {
  const parts = Object.entries(on).filter(([, v]) => v !== undefined) as [keyof On, unknown][];
  const all = Object.values(jobs.value).filter(
    (j) => running(j) && j.project === project && (!kinds || kinds.includes(j.kind)) && parts.every(([k, v]) => j.on[k] === v),
  );
  return all.sort((a, b) => b.since - a.since)[0] ?? null;
}

/** A job of a project about `on`, running or ended, the newest. */
export function lastOn(project: string, on: On, kinds?: string[]): Held | null {
  const parts = Object.entries(on).filter(([, v]) => v !== undefined) as [keyof On, unknown][];
  const all = Object.values(jobs.value).filter(
    (j) => j.project === project && (!kinds || kinds.includes(j.kind)) && parts.every(([k, v]) => j.on[k] === v),
  );
  return all.sort((a, b) => b.since - a.since)[0] ?? null;
}

/** A number as a person reads it: `15,902`. */
const num = (n: number) => Math.round(n).toLocaleString('en-US');

/** A count, in its unit's words: `38 of 103 files`, `41 of 94 MB`, `3 of 7 read`, `2 of 3 readers`, `step 2 of 5`. */
export function countWords(s: Step): string | null {
  if (s.done === undefined || s.total === undefined) return null;
  const values = (d: number, t: number) => ({ done: num(d), total: num(t) });
  switch (s.unit) {
    case 'files':
      return fill('count.files', values(s.done, s.total));
    case 'bytes':
      return fill('count.mb', values(s.done / 1_000_000, s.total / 1_000_000));
    case 'reads':
      return fill('count.read', values(s.done, s.total));
    case 'readers':
      return fill('count.readers', values(s.done, s.total));
    case 'steps':
      return fill('count.steps', values(s.done, s.total));
    default:
      return `${num(s.done)} / ${num(s.total)}`;
  }
}

/** A step's words, its values filled. */
export const stepWords = (s: Step) => fill(s.key, Object.fromEntries(Object.entries(s.args ?? {}).filter(([k]) => k !== 'new')));

/** A step as a line shows it: its mark, its words, its time, and under it its count. */
export interface StepLine {
  state: StepState;
  words: string;
  /** m:ss: done, the time it took; now, the time so far. */
  time: string | null;
  /** The current step's count, `38 of 103 files`. */
  count: string | null;
  /** How many of what it counts are new, `9 of them new`. */
  fresh?: string | null;
}

/** A step's line at `now`: the current one's time runs on from when it was heard. */
export function stepLine(s: Step, heard: number, now: number, words: string = stepWords(s)): StepLine {
  const ms = s.ms === undefined ? null : s.state === 'now' ? s.ms + Math.max(0, now - heard) : s.ms;
  const count = s.state === 'now' ? countWords(s) : null;
  const fresh = count && s.args?.new !== undefined ? fill('count.new', { n: s.args.new }) : null;
  return { state: s.state, words, time: ms === null || s.state === 'next' ? null : elapsed(ms), count, ...(fresh && { fresh }) };
}

/** A job's steps, as lines at `now`. */
export const lines = (j: Held, now: number): StepLine[] => j.steps.map((s) => stepLine(s, j.heard, now));

/** How far the bar fills, 0 to 1; null slides it, as for a wait whose share is not known. */
export function filled(j: Held | null): number | null {
  const s = j?.share;
  return typeof s === 'number' && Number.isFinite(s) ? Math.min(1, Math.max(0, s)) : null;
}

/** The steps of a running Eval as the machine names them, with the time
 * and count its readers' job gives: step by step when both list as many,
 * else the count and time of the step under way. */
export function evalLines(steps: { name: string; light: 'done' | 'now' | 'next' }[], job: Held | null, now: number): StepLine[] {
  const same = job && job.steps.length === steps.length;
  const current = job?.steps.find((s) => s.state === 'now') ?? null;
  return steps.map((s, i) => {
    const from = same ? job.steps[i] : s.light === 'now' ? current : null;
    if (!from || !job) return { state: s.light, words: s.name, time: null, count: null };
    return stepLine({ ...from, state: s.light }, job.heard, now, s.name);
  });
}

/** The sentence a failed job's reason is said in. */
export function failedWords(j: Held): string {
  const why = (j.end?.why ?? '').trim();
  if (j.kind === 'eval_open') return fill('wait.could_not_open_eval', { why });
  if (j.kind === 'seal_check') return fill('wait.could_not_check_receipt', { why });
  return why;
}
