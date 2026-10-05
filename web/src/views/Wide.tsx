// A tablet or a desktop: the tree (380 px) beside the open agent, the bar
// under both (D2.6). One layout for both.
import type { Machine } from '../api';
import * as m from '../machine';
import { swap } from '../nav';
import { Agent } from './Agent';
import { Mark, NeedsYouPill, TreeList } from './Tree';
import { LinkPill } from './Status';
import { WideBar } from './Bar';

export function Wide({ machine, agent }: { machine: Machine; agent: string | null }) {
  return (
    <div class="app">
      <div class="appbar">
        <Mark />
        <h1>{machine.name}</h1>
        {m.link.value !== 'connected' && <LinkPill />}
        <span class="spacer" />
        <NeedsYouPill />
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <nav aria-label="Work" class="tree-side">
          <TreeList machine={machine} onAgent={(a) => swap({ name: 'agent', machine: machine.id, agent: a })} />
        </nav>
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {agent && <Agent key={agent} machine={machine} agent={agent} embedded />}
        </main>
      </div>
      <WideBar />
    </div>
  );
}
