// A tablet or a desktop: the tree (380 px) beside the open agent, or a
// Details view or an Eval view in its place, the bar under both (D11.1–D11.8,
// D6.1).
// One layout for both.
import type { Machine } from '../api';
import * as m from '../machine';
import { type View } from '../nav';
import { besideOf, offered, onePane, show, split } from '../split';
import { w } from '../words';
import { Agent } from './Agent';
import { AskDock } from './Ask';
import { Details, RoundDetails, SealDetails } from './Details';
import { SessionDetails } from './Session';
import { EvalView } from './EvalView';
import { Mark, StartButton, TreeList } from './Tree';
import { StartPanel } from './Start';
import { HeaderPills, Strips } from './Status';
import { TreeBar } from './Bar';
import { MenuButton } from './Settings';
import { TabName, Tabs } from './Tabs';

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

/** The open agent under every project's tabs, or, split, beside the agent shown with it. */
function Agents({ machine, agent }: { machine: Machine; agent: string }) {
  const b = besideOf(agent);
  if (!b) {
    const end = offered.value && (
      <button class="tab-act" type="button" onClick={() => split(agent)}>
        <span aria-hidden="true">{'⫿ '}</span>{w('act.split')}
      </button>
    );
    return <Agent key={agent} machine={machine} agent={agent} embedded head={<div class="tab-row"><Tabs machine={machine.id} open={agent} />{end}</div>} />;
  }
  const sides = b.left ? [b.agent, agent] : [agent, b.agent];
  return (
    <div class="split">
      {sides.map((id, i) => {
        const a = m.agents.value.find((x) => x.agent === id);
        const now = id === agent;
        const head = (
          <div class="tabs">
            <span class="tab" aria-current={now ? 'page' : undefined}>{a && <TabName a={a} />}</span>
            {i === 1 && (
              <button class="tab-act" type="button" aria-pressed="true" onClick={onePane}>
                <span aria-hidden="true">{'⫿ '}</span>{w('act.one_pane')}
              </button>
            )}
          </div>
        );
        // A press in the other side makes it the side with the keys; One pane keeps the side it is.
        return (
          <section key={id} class={now ? 'split-side split-side--current' : 'split-side'} aria-label={a ? `${a.project} · ${a.harness}` : id}>
            <Agent machine={machine} agent={id} embedded side current={now} onPick={(e) => !(e.target as Element).closest('.tab-act') && show(machine.id, id)} head={head} />
          </section>
        );
      })}
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
          <TreeList machine={machine} wide onAgent={(a) => show(machine.id, a)} />
        </nav>
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {view.name === 'eval' ? <EvalView key={`${view.eval}${view.at}${view.files}`} machine={machine} project={view.project} eval={view.eval} at={view.at} files={view.files} wide />
          : view.name === 'detail' ? <Details key={view.unit} machine={machine} project={view.project} unit={view.unit} wide />
          : view.name === 'round' ? <RoundDetails key={view.eval} machine={machine} project={view.project} eval={view.eval} wide />
          : view.name === 'seal' ? <SealDetails key={view.seal} machine={machine} project={view.project} seal={view.seal} wide />
          : view.name === 'session' ? <SessionDetails key={view.session} machine={machine} project={view.project} session={view.session} wide />
          : starting !== null ? <StartPanel machine={machine} harness={starting} project={view.name === 'start' ? view.project : undefined} /> : agent ? <Agents machine={machine} agent={agent} /> : <Woven machine={machine} />}
          <AskDock />
        </main>
      </div>
      <TreeBar machine={machine} wide />
    </div>
  );
}
