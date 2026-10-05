import * as m from '../machine';
import { w } from '../words';

/** The machine's connection, in a word, for the bar. */
export function LinkPill() {
  const l = m.link.value;
  if (l === 'connected') return <span class="fab7-pill fab7-pill--live">{w('web.link.connected')}</span>;
  return <span class="fab7-pill" role={l === 'reconnecting' ? 'status' : undefined}>{w(`web.link.${l}`)}</span>;
}
