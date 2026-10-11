import type { Machine } from '../api';
import * as m from '../machine';
import { fill, w } from '../words';
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

/** When the service last heard from a machine, in this device's time: today a
 * time (14:02), else a date and a time (Oct 9, 14:02). */
export function heardAt(at: number, now = Date.now()): string {
  const d = new Date(at);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === new Date(now).toDateString()) return time;
  return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}, ${time}`;
}

/** The lines under the bar (M13.1, M13.6): what the page waits for while the
 * machine does not answer, and an update the machine waits to start. */
export function Strips({ machine }: { machine: Machine }) {
  const name = machine.name;
  const l = m.link.value;
  const seen = (m.current.value?.id === machine.id ? m.current.value : machine).seen_at;
  const running = m.tree.value.reduce((n, p) => n + p.agents.running, 0);
  return (
    <>
      {m.unreachable.value && l !== 'connected' && l !== 'refused' && (
        <div class="strip" role="status" aria-label="Waiting for the machine">
          <span class="strip-main">{fill('web.unreachable.waiting', { machine: name })}</span>
          <span class="strip-aside">{seen ? fill('web.unreachable.heard', { time: heardAt(seen) }) : w('web.unreachable.never')}</span>
        </div>
      )}
      {m.update.value && l === 'connected' && (
        <div class="strip" role="status" aria-label="An update waiting">
          <span class="strip-main strip-main--update">{fill('web.update.waiting', { version: m.update.value, machine: name })}</span>
          <span class="strip-aside">{running === 1 ? w('web.update.running_one') : fill('web.update.running', { n: String(running) })}</span>
        </div>
      )}
    </>
  );
}
