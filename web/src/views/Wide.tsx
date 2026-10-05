// A tablet or a desktop: the tree (380 px) beside the open agent, the bar
// under both (D2.6). One layout for both.
import type { Machine } from '../api';
import * as m from '../machine';
import { swap } from '../nav';
import { Agent } from './Agent';
import { Mark, NeedsYouPill, StartButton, TreeList } from './Tree';
import { StartPanel } from './Start';
import { LinkPill } from './Status';
import { TreeBar } from './Bar';

/** The empty right pane (D2.1): the woven mark, and the way to start an agent. */
function Woven({ machine }: { machine: Machine }) {
  if (m.tree.value.some((p) => p.harnesses.length > 0)) return null;
  return (
    <div class="woven">
      <pre class="woven-mark">{'╸┃╺╸┃╺╸┃╺╸┃╺\n┃╺╸┃╺╸┃╺╸┃╺╸\n╺╸┃╺╸┃╺╸┃╺╸┃\n╸┃╺╸┃╺╸┃╺╸┃╺\n┃╺╸┃╺╸┃╺╸┃╺╸\n╺╸┃╺╸┃╺╸┃╺╸┃\n╸┃╺╸┃╺╸┃╺╸┃╺'}</pre>
      <StartButton machine={machine} />
    </div>
  );
}

export function Wide({ machine, agent, starting = false }: { machine: Machine; agent: string | null; starting?: boolean }) {
  return (
    <div class="app">
      <div class="appbar">
        <Mark />
        <h1>{machine.name}</h1>
        {m.link.value !== 'connected' && <LinkPill />}
        <span class="spacer" />
        <NeedsYouPill machine={machine} />
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <nav aria-label="Work" class="tree-side">
          <TreeList machine={machine} onAgent={(a) => swap({ name: 'agent', machine: machine.id, agent: a })} />
        </nav>
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {starting ? <StartPanel machine={machine} /> : agent ? <Agent key={agent} machine={machine} agent={agent} embedded /> : <Woven machine={machine} />}
        </main>
      </div>
      <TreeBar machine={machine} wide />
    </div>
  );
}
