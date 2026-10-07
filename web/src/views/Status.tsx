import type { Machine } from '../api';
import * as m from '../machine';
import { w } from '../words';
import { NeedsYouPill } from './Tree';

/** The machine's connection, in a word, for the bar: a filled pill, as the cards draw it. */
export function LinkPill() {
  const l = m.link.value;
  return <span class="link-pill" role={l === 'reconnecting' ? 'status' : undefined}>{w(`web.link.${l}`)}</span>;
}

/** The header's right side (M1.7, M1.8, M2.6, M2.9): while the machine is not
 * connected its pill takes NEEDS YOU's place; ⚡ turbo while a project starts
 * agents in turbo mode. */
export function HeaderPills({ machine }: { machine: Machine }) {
  const turbo = m.link.value === 'connected' && m.tree.value.some((p) => p.turbo);
  return (
    <>
      {m.link.value === 'connected' ? <NeedsYouPill machine={machine} /> : <LinkPill />}
      {turbo && <span class="turbo-pill">{`⚡ ${w('web.turbo')}`}</span>}
    </>
  );
}
