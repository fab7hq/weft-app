// A tablet or a desktop: the tree (380 px) beside the open agent, or a
// Details view, the earlier sessions or an Eval view in its place, the bar
// under both (D11.1–D11.6, D6.1).
// One layout for both.
import type { Machine } from '../api';
import * as m from '../machine';
import { swap, type View } from '../nav';
import { Agent } from './Agent';
import { AskDock } from './Ask';
import { Details, RoundDetails, SealDetails } from './Details';
import { EarlierSessions, SessionDetails } from './Session';
import { EvalView } from './EvalView';
import { Mark, StartButton, TreeList } from './Tree';
import { StartPanel } from './Start';
import { HeaderPills, Strips } from './Status';
import { TreeBar } from './Bar';
import { MenuButton } from './Settings';

/** The empty right pane (D2.1): the woven mark, and the way to start an agent. */
function Woven({ machine }: { machine: Machine }) {
  // While it connects the threads weave (D1.7), with nothing to start yet.
  const weaving = !m.welcomed.value;
  // Only while nothing is in the tree: a project not set up, or a harness not
  // set up, leaves the right side empty until an agent runs (D2.3, D2.4).
  if (!weaving && m.tree.value.some((p) => p.agents.rows.length > 0 || p.setup || (p.ask && p.ask.key !== 'why.start_an_agent'))) return null;
  return (
    <div class={weaving ? 'woven woven--weaving' : 'woven'}>
      <pre class="woven-mark">{'╸┃╺╸┃╺╸┃╺╸┃╺\n┃╺╸┃╺╸┃╺╸┃╺╸\n╺╸┃╺╸┃╺╸┃╺╸┃\n╸┃╺╸┃╺╸┃╺╸┃╺\n┃╺╸┃╺╸┃╺╸┃╺╸\n╺╸┃╺╸┃╺╸┃╺╸┃\n╸┃╺╸┃╺╸┃╺╸┃╺'}</pre>
      {!weaving && <StartButton machine={machine} />}
    </div>
  );
}

export function Wide({ login, machine, agent, starting = null, view }: { login: string; machine: Machine; agent: string | null; starting?: string | null; view: View }) {
  return (
    <div class="app">
      <div class="appbar">
        <Mark />
        <h1>{machine.name}</h1>
        <span class="spacer" />
        <HeaderPills machine={machine} />
        <MenuButton login={login} />
      </div>
      <Strips machine={machine} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <nav aria-label="Work" class="tree-side">
          <TreeList machine={machine} wide onAgent={(a) => swap({ name: 'agent', machine: machine.id, agent: a })} />
        </nav>
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {view.name === 'eval' ? <EvalView key={`${view.eval}${view.at}${view.files}`} machine={machine} project={view.project} eval={view.eval} at={view.at} files={view.files} wide />
          : view.name === 'detail' ? <Details key={view.unit} machine={machine} project={view.project} unit={view.unit} wide />
          : view.name === 'round' ? <RoundDetails key={view.eval} machine={machine} project={view.project} eval={view.eval} wide />
          : view.name === 'seal' ? <SealDetails key={view.seal} machine={machine} project={view.project} seal={view.seal} wide />
          : view.name === 'session' ? <SessionDetails key={view.session} machine={machine} project={view.project} session={view.session} wide />
          : view.name === 'earlier' ? <EarlierSessions key={view.project} machine={machine} project={view.project} wide />
          : starting !== null ? <StartPanel machine={machine} harness={starting} /> : agent ? <Agent key={agent} machine={machine} agent={agent} embedded /> : <Woven machine={machine} />}
          <AskDock />
        </main>
      </div>
      <TreeBar machine={machine} wide />
    </div>
  );
}
