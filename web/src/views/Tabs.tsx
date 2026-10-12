// The TUI's tabs (web-app.md §4): every open project's running agents, in the
// tree's order, named `project · harness`. One that needs its person carries
// an amber ●; one whose harness is not set up for RingFrame carries ⚠. A tap
// opens it in place of the open one.
import * as m from '../machine';
import { show, tabbed } from '../split';

/** Whether the agent's harness is not set up for RingFrame in its project, as the tree says. */
export const notSetUp = (a: m.Agent) =>
  m.tree.value.some((p) => p.project === a.project && p.ask?.key === 'why.not_set_up' && p.ask.harness === a.harness);

/** A tab's name and marks. */
export function TabName({ a }: { a: m.Agent }) {
  return (
    <>
      {`${a.project} · ${a.harness}${notSetUp(a) ? ' ⚠' : ''}`}
      {a.turn === 'waiting' && <span class="tab-needs"> ●</span>}
    </>
  );
}

export function Tabs({ machine, open }: { machine: string; open: string }) {
  return (
    <nav class="tabs" aria-label="Tabs">
      {tabbed.value.map((a) => (
        <button
          key={a.agent}
          type="button"
          class={a.turn === 'waiting' ? 'tab tab--needs-you' : 'tab'}
          data-needs-you={a.turn === 'waiting' ? 'true' : undefined}
          aria-current={a.agent === open ? 'page' : undefined}
          onClick={() => show(machine, a.agent)}
        >
          <TabName a={a} />
        </button>
      ))}
    </nav>
  );
}
