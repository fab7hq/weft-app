import type { Machine } from '../api';
import * as m from '../machine';
import { go } from '../nav';
import { LinkPill } from './Status';
import { turnWord } from '../words';


const PILL: Record<m.Agent['turn'], string> = { waiting: 'Needs you', working: 'Working', ready: 'Ready', ended: 'Ended' };

/** How long, said short. */
export function since(at: number, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - at) / 60_000));
  if (min < 1) return 'now';
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} d`;
}

export function NeedsYou() {
  const n = m.needsYou.value;
  if (n === 0) return null;
  return (
    <span class="fab7-pill fab7-pill--count" aria-label={n === 1 ? '1 needs you' : `${n} need you`}>
      {n}
    </span>
  );
}

/** NEEDS YOU first, then Working, then Idle, each in the machine's order. */
export function AgentList({ machine, open }: { machine: Machine; open?: string }) {
  const all = m.agents.value;
  const groups: [string, m.Agent[], boolean][] = [
    ['Needs you', all.filter((a) => a.turn === 'waiting'), true],
    ['Working', all.filter((a) => a.turn === 'working'), false],
    ['Idle', all.filter((a) => a.turn === 'ready' || a.turn === 'ended'), false],
  ];
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {all.length === 0 && <p class="note" style={{ padding: '24px 16px' }}>No agent is running on {machine.name}.</p>}
      {groups
        .filter(([, list]) => list.length > 0)
        .map(([name, list, needs]) => (
          <section key={name} aria-label={name}>
            <div class={needs ? 'fab7-group fab7-group--needs-you' : 'fab7-group'}>{name}</div>
            {list.map((a) => (
              <button
                key={a.agent}
                type="button"
                class={a.agent === open ? 'fab7-row fab7-row--open' : 'fab7-row'}
                style={{ width: '100%', background: a.agent === open ? undefined : 'none', border: 0, borderBottom: '1px solid var(--fab7-line)', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                onClick={() => go({ name: 'agent', machine: machine.id, agent: a.agent })}
              >
                <span class="fab7-row__title">{a.project} · {a.title}</span>
                <span class="fab7-row__meta">{turnWord(a.turn)}</span>
                <span class="fab7-row__since">
                  <span class={a.turn === 'waiting' ? 'fab7-pill fab7-pill--needs-you' : 'fab7-pill'}>{PILL[a.turn]}</span>
                  {since(a.since)}
                </span>
              </button>
            ))}
          </section>
        ))}
    </div>
  );
}

export function Agents({ machine }: { machine: Machine }) {
  return (
    <div class="app">
      <div class="appbar">
        <h1>{machine.name}</h1>
        <LinkPill />
        <span class="spacer" />
        <NeedsYou />
        <button class="back" type="button" onClick={() => go({ name: 'settings' })}>Settings</button>
      </div>
      <AgentList machine={machine} />
    </div>
  );
}
