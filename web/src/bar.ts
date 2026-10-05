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
