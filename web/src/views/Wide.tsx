// A tablet or a desktop: the Agents list (360 px) beside the open agent
// (web-app.md §4). One layout for both.
import type { Machine } from '../api';
import { go } from '../nav';
import { Agent } from './Agent';
import { AgentList, NeedsYou } from './Agents';
import { LinkPill } from './Status';
import { WideBar } from './Bar';

export function Wide({ machine, agent }: { machine: Machine; agent: string | null }) {
  return (
    <div class="app">
      <div class="appbar">
        <img src="/icons/weft-mark.svg" alt="" width={24} height={24} />
        <h1>{machine.name}</h1>
        <LinkPill />
        <span class="spacer" />
        <NeedsYou />
        <button class="back" type="button" onClick={() => go({ name: 'settings' })}>Settings</button>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <nav aria-label="Agents" style={{ flex: '0 0 360px', width: '360px', boxSizing: 'border-box', borderRight: '1px solid var(--fab7-line)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <AgentList machine={machine} open={agent ?? undefined} />
        </nav>
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {agent ? (
            <Agent key={agent} machine={machine} agent={agent} embedded />
          ) : (
            <div class="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
              <p class="lede">Pick an agent to see its screen.</p>
            </div>
          )}
        </main>
      </div>
      <WideBar />
    </div>
  );
}
