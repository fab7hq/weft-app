// The TUI's tabs (web-app.md §4): the open agents, numbered, amber when one
// needs its person. A tap opens it in place of the open one.
import * as m from '../machine';
import { swap } from '../nav';

export function Tabs({ machine, open }: { machine: string; open: string }) {
  return (
    <nav class="tabs" aria-label="Tabs">
      {m.agents.value.map((a, i) => (
        <button
          key={a.agent}
          type="button"
          class={a.turn === 'waiting' ? 'tab tab--needs-you' : 'tab'}
          data-needs-you={a.turn === 'waiting' ? 'true' : undefined}
          aria-current={a.agent === open ? 'page' : undefined}
          onClick={() => a.agent !== open && swap({ name: 'agent', machine, agent: a.agent })}
        >
          {`${i + 1} ${a.project} · ${a.title}`}
        </button>
      ))}
    </nav>
  );
}
