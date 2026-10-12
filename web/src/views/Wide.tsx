// A tablet or a desktop: the tree (380 px) beside the open agent, or a
// Details view or an Eval view in its place, the bar under both (D11.1–D11.8,
// D6.1).
// One layout for both.
import type { Machine } from '../api';
import * as m from '../machine';
import { type View } from '../nav';
import { useEffect, useRef } from 'preact/hooks';
import * as L from '../layout';
import { focusPane, held, layout, most, over, room, show } from '../panes';
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
import { TabName, Tabs, dropped } from './Tabs';

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

/** One pane: its tab bar, its agent, and where a held tab would land in it. */
function PaneBox({ machine, pane, many, open }: { machine: Machine; pane: L.Pane; many: boolean; open: string }) {
  const current = pane.id === L.active(layout.value).id;
  // The open agent, ended, is in no pane: the pane you are in says so in its place.
  const agent = current && L.paneOf(layout.value, open) === undefined ? open : L.showing(pane);
  const a = m.agents.value.find((x) => x.agent === agent);
  const to = over.value;
  const here = to && (('edge' in to && to.edge === pane.id) || ('middle' in to && to.middle === pane.id)) ? to : null;
  const name = m.agents.value.find((x) => x.agent === held.value);
  // A held tab over this pane: its outer fifth splits it that way, its middle takes it in.
  const onDragOver = (e: DragEvent) => {
    if (!held.value) return;
    e.preventDefault();
    const r = (e.currentTarget as Element).getBoundingClientRect();
    over.value = L.zone(pane.id, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };
  const head = <Tabs machine={machine.id} pane={pane} current={current || !many} />;
  return (
    <section
      class={current && many ? 'pane-box pane-box--current' : 'pane-box'}
      aria-label={a ? `${a.project} · ${a.harness}` : undefined}
      onDragOver={onDragOver}
      onDrop={(e) => dropped(machine.id, e)}
    >
      {agent ? (
        <Agent key={agent} machine={machine} agent={agent} embedded side={many} current={current || !many} onPick={() => focusPane(machine.id, pane.id)} head={head} />
      ) : head}
      {here && (
        <div class={`drop-zone drop-zone--${'edge' in here ? here.side : 'middle'}`} aria-hidden="true">
          {name && <span class="tab drop-tab"><TabName a={name} /></span>}
        </div>
      )}
    </section>
  );
}

/** A level of the tree of panes: a pane, or panes side by side or one below another, sharing the space equally. */
function Level({ machine, node, open }: { machine: Machine; node: L.Node; open: string }) {
  if ('pane' in node) return <PaneBox machine={machine} pane={node.pane} many open={open} />;
  return (
    <div class={`panes-${node.axis}`}>
      {node.kids.map((kid) => {
        const first = 'pane' in kid ? kid.pane.id : L.panes({ root: kid, active: 0, next: 0 })[0].id;
        return <Level key={first} machine={machine} node={kid} open={open} />;
      })}
    </div>
  );
}

/** The panes, each with its own tabs; a window too small for the layout shows the pane you are in alone, the layout kept. */
function Agents({ machine, open }: { machine: Machine; open: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const seen = new ResizeObserver(() => (room.value = { width: el.clientWidth, height: el.clientHeight }));
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  const l = layout.value;
  const many = L.count(l) > 1 && L.count(l) <= most.value && L.fits(l, room.value);
  return (
    <div class={many ? 'panes panes--many' : 'panes'} ref={box} onDragLeave={(e) => !box.current?.contains(e.relatedTarget as Node | null) && (over.value = null)}>
      {many ? <Level machine={machine} node={l.root} open={open} /> : <PaneBox machine={machine} pane={L.active(l)} many={false} open={open} />}
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
          : starting !== null ? <StartPanel machine={machine} harness={starting} project={view.name === 'start' ? view.project : undefined} /> : agent ? <Agents machine={machine} open={agent} /> : <Woven machine={machine} />}
          <AskDock />
        </main>
      </div>
      <TreeBar machine={machine} wide />
    </div>
  );
}
