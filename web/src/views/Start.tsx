// Start an agent (M9.7, D9.7): the harnesses the project can start, fresh, as
// the TUI's N lists them; Start opens the new agent.
import { useState } from 'preact/hooks';
import type { Machine } from '../api';
import * as m from '../machine';
import { back, swap } from '../nav';
import { selected } from './Tree';
import { fill, w } from '../words';

/** The project an agent starts in when none was chosen: the selection's, else the first. */
function project(): string | undefined {
  return selected.value?.project ?? m.tree.value[0]?.project ?? m.harnesses.value[0]?.project;
}

/** The list and Start: in the right pane on a desktop (D9.7), or under the phone's bar (M9.7). */
export function StartPanel({ machine, harness, project: chosen, phone = false }: { machine: Machine; harness?: string; project?: string; phone?: boolean }) {
  // With more than one project open, the person chooses which one (M9.8).
  const projects = m.tree.value;
  const [picked, setAt] = useState<string | null>(null);
  const at = picked ?? chosen ?? project();
  const starts = m.harnesses.value.filter((s) => s.project === at);
  const [pick, setPick] = useState(Math.max(0, starts.findIndex((s) => s.harness === harness)));
  const several = projects.length > 1;
  const [said, setSaid] = useState<string | null>(null);
  const start = async () => {
    const s = starts[pick];
    if (!s) return;
    setSaid(null);
    const answer = await m.request({ type: 'start', project: s.project, harness: s.harness });
    if (answer?.type === 'ok' && answer.agent) swap({ name: 'agent', machine: machine.id, agent: String(answer.agent) });
    else if (answer?.type === 'error') setSaid(String(answer.message));
  };
  const acts = (
    <>
      <button class="tree-act" type="button" onClick={back}>{w('act.cancel')}</button>
      <button class="tree-act tree-act--go" type="button" onClick={() => void start()}>{w('act.start')}</button>
    </>
  );
  return (
    <>
      {!phone && <h2 class="start-head">{w('start.title')}</h2>}
      <div class={phone ? 'start' : 'start start--wide'}>
        <p class="start-lede">{fill('web.start.runs_on', { machine: machine.name })}</p>
        {several && (
          <>
            <div class="fab7-group settings-group start-pick">{w('web.start.project')}</div>
            <div class="start-list" role="radiogroup" aria-label={w('web.start.project')}>
              {projects.map((p) => (
                <button key={p.project} type="button" role="radio" aria-checked={p.project === at} class="start-option" onClick={() => (setAt(p.project), setPick(0))}>
                  <span class={p.project === at ? 'start-radio' : 'start-radio start-radio--off'}>{p.project === at ? '◉' : '○'}</span>
                  <span class="start-name">{p.project}</span>
                  <span class="start-aside">{p.open === 0 && p.agents.rows.length === 0 ? w('web.start.nothing_yet') : `${p.open} ${w('title.open')}`}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {starts.length === 0 ? (
          <p class="start-said" role="status">{fill('web.start.none', { machine: machine.name })}</p>
        ) : (
          <>
            {(phone || several) && <div class="fab7-group settings-group start-pick">{several ? w('web.start.harness') : w('web.start.pick_one')}</div>}
            <div class="start-list" role="radiogroup" aria-label={w('start.title')}>
              {starts.map((s, i) => (
                <button key={s.harness} type="button" role="radio" aria-checked={i === pick} class="start-option" onClick={() => setPick(i)}>
                  <span class={i === pick ? 'start-radio' : 'start-radio start-radio--off'}>{i === pick ? '◉' : '○'}</span>
                  {fill('start.fresh', { harness: s.harness })}
                </button>
              ))}
            </div>
          </>
        )}
        {said && <p class="start-said" role="status">{said}</p>}
      </div>
      {phone ? (
        <div class="tree-bar">
          <div class="tree-acts">{acts}</div>
        </div>
      ) : (
        <div class="start-bar">{acts}</div>
      )}
    </>
  );
}

/** The phone's page. */
export function StartPage({ machine, from, harness, project }: { machine: Machine; from: string; harness?: string; project?: string }) {
  return (
    <div class="app">
      <div class="appbar">
        <button class="back" type="button" onClick={back}>{`‹ ${from}`}</button>
        <h1>{w('start.title')}</h1>
      </div>
      <StartPanel machine={machine} harness={harness} project={project} phone />
    </div>
  );
}
