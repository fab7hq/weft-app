// The earlier sessions, a page at a time: how their count reads, what an
// earlier row says under its title, and what the row under the shown ones
// offers.
import { agentTime } from './bar';
import { fill } from './words';

/** How many earlier sessions one read brings, as the machine pages them. */
export const PAGE = 50;

/** A count with thousands separators: `1,204`. */
export const count = (n: number): string => n.toLocaleString('en-US');

/** Under an earlier session's title: its harness, unless the title already
 * is its harness, and when it was last active, with its day. */
export function pastAbout(e: { harness: string; title: string | null; at: number }, now: number = Date.now()): string {
  const time = agentTime(e.at, now);
  return [...(e.title ? [e.harness] : []), ...(time ? [time] : [])].join(' · ');
}

/** The row under the shown sessions: `Show 50 more` and `50 of 1,204`, the
 * ones left when fewer than a page are; none once every one is shown. */
export function moreOf(shown: number, total: number): { more: string; shown: string } | null {
  if (shown >= total) return null;
  return {
    more: fill('tree.earlier_more', { n: String(Math.min(PAGE, total - shown)) }),
    shown: fill('tree.earlier_shown', { shown: count(shown), total: count(total) }),
  };
}
