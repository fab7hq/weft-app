// The TUI's tabs (web-app.md §4): the open agents, numbered. One that needs
// its person is amber (M3.4); one whose harness is not set up for RingFrame
// carries ⚠ (M3.8). A tap opens it in place of the open one.
import * as m from '../machine';
import { swap } from '../nav';

/** Whether this agent runs in turbo mode, as the tree says of its harness. */
const turbo = (agent: string) => m.tree.value.some((p) => p.harnesses.some((h) => h.agent === agent && h.turbo));

/** Whether the agent's harness is not set up for RingFrame in its project, as the tree says. */
export const notSetUp = (a: m.Agent) =>
  m.tree.value.some((p) => p.project === a.project && p.ask?.key === 'why.not_set_up' && p.ask.harness === a.harness);

export function Tabs({ machine, open }: { machine: string; open: string }) {
  return (
    <nav class="tabs" aria-label="Tabs">
      {m.agents.value.filter((a) => a.running).map((a, i) => (
        <button
          key={a.agent}
          type="button"
          class={a.turn === 'waiting' ? 'tab tab--needs-you' : 'tab'}
          data-needs-you={a.turn === 'waiting' ? 'true' : undefined}
          aria-current={a.agent === open ? 'page' : undefined}
          onClick={() => a.agent !== open && swap({ name: 'agent', machine, agent: a.agent })}
        >
          {`${i + 1} ${a.harness}${turbo(a.agent) ? ' ⚡' : ''}${notSetUp(a) ? ' ⚠' : ''}${a.turn === 'waiting' ? ' ●' : ''}`}
        </button>
      ))}
    </nav>
  );
}
