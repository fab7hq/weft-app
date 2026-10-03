import * as m from '../machine';

/** The machine's connection, in a word, for the bar. */
export function LinkPill() {
  const l = m.link.value;
  if (l === 'connected') return <span class="fab7-pill fab7-pill--live">Connected</span>;
  if (l === 'reconnecting') return <span class="fab7-pill" role="status">Reconnecting</span>;
  if (l === 'asking') return <span class="fab7-pill">Asking</span>;
  if (l === 'refused') return <span class="fab7-pill">Refused</span>;
  return <span class="fab7-pill">Connecting</span>;
}
