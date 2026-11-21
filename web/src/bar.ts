// The confirmation bar's words, from the machine's own.
import type { Project, Why } from './machine';
import { fill, w } from './words';

/** The machine's why, as the bar says it: its wrapped lines joined into sentences. */
export function why(text: string): string[] {
  const said: string[] = [];
  let open = false;
  for (const line of text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
    if (open) said[said.length - 1] += ` ${line}`;
    else said.push(line);
    open = !/[.?!:]$/.test(line);
  }
  return said;
}

/** A time of day, as the desktop app says one: HH:MM of the record's UTC day. */
export function clock(at: number): string {
  const minutes = Math.floor(at / 60_000) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 24 * 60 * 60 * 1000;

/** A time with its day, as an agent's row reads it, as the desktop app says
 * one: `Today 11:29`, `Yesterday 18:40`, or its date, `Nov 12 08:15`, with
 * the year when it is not this one, `Dec 12 2025 12:00`. `offset` is the
 * distance from UTC, in milliseconds; a time after `now` is today. */
export function dayTime(at: number, now: number, offset: number): string {
  const local = at + offset;
  const time = clock(local);
  const days = Math.floor((now + offset) / DAY) - Math.floor(local / DAY);
  if (days <= 0) return fill('time.today', { time });
  if (days === 1) return fill('time.yesterday', { time });
  const d = new Date(local);
  const date = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const year = d.getUTCFullYear();
  return year === new Date(now + offset).getUTCFullYear() ? `${date} ${time}` : `${date} ${year} ${time}`;
}

/** An agent's time with its day, on this device's clock; nothing when it has none. */
export function agentTime(at: number, now: number = Date.now()): string {
  return at > 0 ? dayTime(at, now, -new Date(now).getTimezoneOffset() * 60_000) : '';
}

/** At most `n` characters, ending in … when cut, as the desktop app clips. */
export function clip(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

/** A day and a time, as the desktop app stamps one: `2026-10-08 11:29`, of the record's UTC day. */
export function stamp(at: number): string {
  return `${new Date(at).toISOString().slice(0, 10)} ${clock(at)}`;
}

/** A day and a time, as a person reads them: `17 Nov 11:20`. */
export function dayClock(at: number): string {
  const d = new Date(at);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${clock(at)}`;
}

/** A dialog's yes button, as the machine names it. */
export interface Go {
  word: string;
  /** It stops something: amber. */
  warn: boolean;
}

/** A dialog's yes: Send, or the button the machine names, amber when it stops something. */
export function yesOf(pending: { go?: Go | null }): { label: string; tone: 'go' | 'warn' } {
  const go = pending.go;
  return { label: w(go?.word ?? 'act.send'), tone: go?.warn ? 'warn' : 'go' };
}

/** What Weft reads of a harness's setup: said where the act is, never a stop,
 * since the reading may be wrong. Every other why-not stops its act. */
export function isSetup(why: Why | null | undefined): why is Why {
  return why?.key === 'why.not_set_up' || why?.key === 'why.cannot_ask';
}

/** A why-not in the web's words; a harness not set up says where to set it up. */
export function sentence(why: Why, machine: string): string {
  const s = fill(why.key, { harness: why.harness ?? '', title: why.title ?? '', machine });
  return why.key === 'why.not_set_up' ? `${s} ${fill('web.why.set_up_on', { machine })}` : s;
}

/** What Weft read of the setup of the harness an Ask goes to: on its agent's row, else on the project. */
export function setupOf(p: Pick<Project, 'ask' | 'agents'> | undefined, harness: string, agent?: string): Why | null {
  const rows = p?.agents.rows.filter((r) => r.harness === harness) ?? [];
  const mine = agent ? rows.filter((r) => r.agent === agent) : rows;
  const said = [...mine.map((r) => r.ask), p?.ask].find((why) => isSetup(why) && why.harness === harness);
  return said ?? null;
}

/** The Ask sheet's one warning: Weft's own reading of the harness first, else
 * why the machine would not draft the Ask. Either way the Ask can still go. */
export function askWarning(setup: Why | null, refused: string | null, machine: string): string | null {
  if (setup) return sentence(setup, machine);
  return refused ? `${fill('ask.may_not', { why: refused.trim().replace(/\.$/, '') })}.` : null;
}
