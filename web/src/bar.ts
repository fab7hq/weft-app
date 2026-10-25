// The confirmation bar's words, from the machine's own.
import { w } from './words';

/**
 * The machine's why, as the bar says it: its wrapped lines joined into
 * sentences, and without the line that says what will be typed where, which
 * the bar's header and its box already show.
 */
export function why(text: string): string[] {
  const typing = w('bar.will_type').split('{')[0].trim();
  const said: string[] = [];
  let open = false;
  for (const line of text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
    if (open) said[said.length - 1] += ` ${line}`;
    else said.push(line);
    open = !/[.?!:]$/.test(line);
  }
  return said.filter((s) => !s.startsWith(typing));
}

/** A time of day, as the desktop app says one: HH:MM of the record's UTC day. */
export function clock(at: number): string {
  const minutes = Math.floor(at / 60_000) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** At most `n` characters, ending in … when cut, as the desktop app clips. */
export function clip(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

/** A day and a time, as the desktop app stamps one: `2026-10-08 11:29`, of the record's UTC day. */
export function stamp(at: number): string {
  return `${new Date(at).toISOString().slice(0, 10)} ${clock(at)}`;
}

/** A weekday and a time, for a session earlier this week: `Tue 17:02`. */
export function weekday(at: number): string {
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(at).getUTCDay()]} ${clock(at)}`;
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
