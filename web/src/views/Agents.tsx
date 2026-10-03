import type { Machine } from '../api';
import * as m from '../machine';
import { go } from '../nav';
import { LinkPill } from './Status';

export function Agents({ machine }: { machine: Machine }) {
  return (
    <div class="app">
      <div class="appbar">
        <h1>{machine.name}</h1>
        <LinkPill />
        <span class="spacer" />
        <button class="back" type="button" onClick={() => go({ name: 'settings' })}>Settings</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {m.agents.value.map((a) => (
          <button
            key={a.agent}
            type="button"
            class="fab7-row"
            style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--fab7-line)', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
            onClick={() => go({ name: 'agent', machine: machine.id, agent: a.agent })}
          >
            <span class="fab7-row__title">{a.project} · {a.title}</span>
            <span class="fab7-row__meta">{a.turn}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
