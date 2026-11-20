// What this device asked the machine for and still waits on, said at once
// where the person acted; and why one failed, said there until the person
// acts again. Nothing still working shows as empty, as none or as failed.
import { signal } from '@preact/signals';
import * as J from './jobs';
import { fill, w } from './words';

/** A machine's answer, `ok` or `error`. */
export type Answer = Record<string, unknown>;

/** The number a request was sent with, when it was sent. */
const reqOf = (asked: Promise<Answer> | null) => (asked as { req?: number } | null)?.req;

/** Past this, a wait also shows a moving bar and the time it has taken. */
export const LONG_AFTER = 3000;

/** The time a wait has taken, as m:ss. */
export function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Whether a wait begun at `since` has taken long enough by `now` to show its bar and its time. */
export const isLong = (since: number, now: number) => now - since >= LONG_AFTER;

/** An act working after a yes, in the bar's place: its words, what it is on,
 * since when, and the work whose row says it too. */
export interface Working {
  words: string;
  about: string;
  since: number;
  unit?: string;
  /** The words key its work's row says while it works. */
  row?: string;
  /** The request it sent: the machine's job for it says its steps. */
  req?: number;
}

export const working = signal<Working | null>(null);

/** Why the last wait failed: said where its work was shown, until the person acts again. */
export const failed = signal<string | null>(null);

/** The person acted: a failure said before has been read. */
export function acted(): void {
  failed.value = null;
}

/** How many settings this device has sent the machine and it has not answered yet. */
export const saving = signal(0);

/** A setting sent: said saving until the machine answers; what it would not
 * take, or that nothing could be sent, stays said until the person acts again. */
export async function save(ask: () => Promise<Answer> | null): Promise<Answer | null> {
  failed.value = null;
  const asked = ask();
  if (!asked) {
    failed.value = w('web.why.not_connected');
    return null;
  }
  saving.value += 1;
  try {
    const answer = await asked;
    if (answer.type === 'error') failed.value = why(answer);
    return answer;
  } finally {
    saving.value -= 1;
  }
}

/** What a refusal says: the machine's sentence, else its code. */
export const why = (a: Answer) => String(a.message ?? a.code ?? '');

/**
 * Show `shown` working in the bar while the machine answers what `ask` sent;
 * nothing runs while another is working. Its refusal, or that nothing could
 * be sent, stays as `failed` unless `keep` takes it. The answer, or null when
 * nothing was sent.
 */
export async function during(
  shown: Omit<Working, 'since'>,
  ask: () => Promise<Answer> | null,
  keep: (a: Answer) => boolean = () => false,
): Promise<Answer | null> {
  if (working.value) return null;
  failed.value = null;
  const asked = ask();
  if (!asked) {
    failed.value = w('web.why.not_connected');
    return null;
  }
  working.value = { ...shown, since: Date.now(), req: reqOf(asked) };
  try {
    const answer = await asked;
    if (answer.type === 'error' && !keep(answer)) failed.value = why(answer);
    return answer;
  } finally {
    working.value = null;
  }
}

/** A read of the machine's: what it said, why it failed, or neither while it is out. */
export type Read<T> = { got: T; failed: null } | { got: null; failed: string } | { got: null; failed: null };

/** What an answer to a read of `what` gives; a read not sent, or lost with
 * the connection, is still to come: it is read again once connected. */
export function readOf<T>(answer: Answer | null, what: string): Read<T> {
  if (!answer || answer.lost === true) return { got: null, failed: null };
  if (answer.type === 'ok') return { got: answer[what] as T, failed: null };
  return { got: null, failed: why(answer) };
}

/** The words a work's row says while it works: its Eval opening or its Seal,
 * from here or elsewhere, or the act this device works on for it. */
export function rowWord(unit: string, project: string): string | null {
  if (mine.value?.unit === unit && mine.value.project === project) return w('wait.row_opening_eval');
  const job = J.byOn(project, { work: unit }, ['eval_open', 'seal']);
  if (job) return w(job.kind === 'seal' ? 'wait.row_sealing' : 'wait.row_opening_eval');
  const now = working.value;
  return now?.unit === unit && now.row ? w(now.row) : null;
}

/** The Eval this device opened, while it opens: its work, what its block says
 * of it, since when, and the request its yes was sent with; `lost` once no
 * answer will tell it has ended (the connection closed first, or it was
 * opening already), and only the machine's job for it will. */
export interface Opening {
  project: string;
  unit: string;
  title: string;
  asks: number;
  harness: string;
  since: number;
  lost: boolean;
  req?: number;
}

export const mine = signal<Opening | null>(null);

/** Long enough after the machine welcomed this device again to have said its jobs. */
export const OPENING_TOLD_WITHIN = 10_000;

/** This device's Eval that ended while no answer could say so: its view opens, if the Eval runs. */
export const ended = signal<Opening | null>(null);

/** The work whose open was last refused: its view does not open. */
export const refused = signal<string | null>(null);

/** Every job this device has seen running, and each failure it has said, so one said again after a welcome is not repeated. */
const seen = new Set<string>();
const told = new Set<string>();

/** Say why an open of `unit` was refused, once. */
function refusedOpen(unit: string, reason: string): void {
  refused.value = unit;
  const key = `${unit}\n${reason.trim()}`;
  if (told.has(key)) return;
  told.add(key);
  failed.value = fill('wait.could_not_open_eval', { why: reason.trim() });
}

/** The Eval this device opened is the one a job opens. */
const isMine = (j: J.Held) => {
  const o = mine.value;
  return !!o && j.kind === 'eval_open' && ((o.req !== undefined && j.req === o.req) || (o.project === j.project && o.unit === j.on.work));
};

/** What a job heard means here: an Eval this device opened, ended while its
 * answer was lost, opens its view; a failure of a job this device began or
 * saw running is said, once, until the person acts. */
function heardJob(j: J.Held): void {
  if (!j.end) {
    seen.add(j.id);
    return;
  }
  const ours = isMine(j);
  if (j.end.ok) {
    if (ours && mine.value!.lost) {
      ended.value = mine.value;
      mine.value = null;
    }
    return;
  }
  // An open shows on every device's row; any other wait only where it was begun.
  const shown = j.req !== undefined || (j.kind === 'eval_open' && seen.has(j.id));
  if (!ours && !shown) return;
  if (ours) mine.value = null;
  if (j.kind === 'eval_open' && j.on.work) return refusedOpen(j.on.work, j.end.why ?? '');
  if (told.has(j.id)) return;
  told.add(j.id);
  failed.value = J.failedWords(j);
}

/** A job moved. */
export function heardProgress(msg: Answer): void {
  const j = J.heardProgress(msg);
  if (j) heardJob(j);
}

/** Every job of one project, said after a welcome: the Eval this device
 * opened, its answer lost, has ended if no job for it is said. */
export function heardJobs(msg: Answer): void {
  const told = J.heardJobs(msg);
  for (const j of told) heardJob(j);
  const o = mine.value;
  if (!o || !o.lost || o.project !== String(msg.project ?? '')) return;
  if (told.some((j) => j.kind === 'eval_open' && j.on.work === o.unit)) return;
  mine.value = null;
  ended.value = o;
}

/** The machine welcomed this device again: its jobs are said afresh. */
export function welcomedAgain(): void {
  J.welcomed();
}

/** Nothing was said of them within a while of coming back: they have ended,
 * and the block of an open no answer will tell goes; the tree says where it stands. */
export function notToldAgain(): void {
  J.notToldAgain();
  if (mine.value?.lost) mine.value = null;
}

/** This device opens an Eval: its block shows until the machine answers. */
export function startOpening(o: Omit<Opening, 'since' | 'lost'>, now = Date.now()): void {
  failed.value = null;
  if (refused.value === o.unit) refused.value = null;
  // A new open: its refusal, if any, is said again, and the one kept is let go.
  for (const k of told) if (k.startsWith(`${o.unit}\n`)) told.delete(k);
  const kept = J.lastOn(o.project, { work: o.unit }, ['eval_open']);
  if (kept?.end && !kept.end.ok) J.letGo(kept.id);
  mine.value = { ...o, since: now, lost: false };
}

/** The request the Eval's yes was sent with: its job is the one shown. */
export function openSent(asked: Promise<Answer> | null): void {
  const req = reqOf(asked);
  if (mine.value && req !== undefined) mine.value = { ...mine.value, req };
}

/** What the machine answered the Eval's yes: open its view, keep waiting (the
 * answer was lost with the connection, or it is opening already), or the
 * failure, said in amber until the person acts. */
export function openAnswered(answer: Answer | null): 'open' | 'kept' | 'failed' {
  const o = mine.value;
  if (!o) return 'kept';
  if (!answer) {
    mine.value = null;
    failed.value = w('web.why.not_connected');
    return 'failed';
  }
  if (answer.lost === true) {
    mine.value = { ...o, lost: true };
    return 'kept';
  }
  if (answer.type === 'ok') {
    mine.value = null;
    return 'open';
  }
  // Opening already, from another press: its job says when it ends.
  if (answer.code === 'opening') {
    mine.value = { ...o, lost: true, req: undefined };
    return 'kept';
  }
  mine.value = null;
  refusedOpen(o.unit, why(answer));
  return 'failed';
}

/** The job of the Eval this device opened, or of the work at `project`/`unit`, while it opens. */
export function openingJob(project: string, unit: string): J.Held | null {
  const o = mine.value;
  return (o && o.project === project && o.unit === unit ? J.byReq(o.req) : null) ?? J.byOn(project, { work: unit }, ['eval_open']);
}
